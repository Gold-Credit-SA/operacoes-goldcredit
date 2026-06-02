-- ============================================================================
-- Smart Scraper — cache de anexos (boleto/NF) + bucket + feature flag + cron
-- ----------------------------------------------------------------------------
-- Decisões consolidadas:
--   1. Sync/Async: pre-fetch via cron + fallback síncrono com fila/lock
--   2. Mapeamento titulo_id -> dados de navegação: edge resolve (worker burro)
--   3. Upload no Storage: edge faz upload (worker devolve base64)
--   4. Cache TTL: boleto 6h ou invalidação por evento; NF 30 dias
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabela de cache
-- ----------------------------------------------------------------------------
create table if not exists public.smart_anexos_cache (
  titulo_id              text        not null,
  tipo                   text        not null check (tipo in ('boleto', 'nf')),
  storage_path           text        not null,
  bytes                  integer     not null check (bytes > 0),
  fetched_at             timestamptz not null default now(),
  expires_at             timestamptz not null,
  -- Quando o título foi atualizado no Smart pela última vez na hora do cache.
  -- Permite invalidar quando o título sofreu mudança (vencimento prorrogado,
  -- juros somados etc.) sem ter que esperar TTL expirar.
  source_updated_at      timestamptz,
  -- Snapshot de status do título no momento do scrape (emaberto, vencido,
  -- quitado). Usado pra decidir se NF ainda é a mesma.
  source_status          text,
  -- Última request que originou esse cache. Útil pra debug.
  last_requested_by      uuid,
  -- Telemetria.
  hit_count              integer     not null default 0,
  primary key (titulo_id, tipo)
);

create index if not exists idx_smart_anexos_expires_at
  on public.smart_anexos_cache (expires_at);

create index if not exists idx_smart_anexos_fetched_at
  on public.smart_anexos_cache (fetched_at);

comment on table public.smart_anexos_cache is
  'Cache de boletos/NFs baixados do portal Smart via scraping. TTL: 6h boleto, 30d NF, ou invalidado por mudança de source_updated_at.';

-- ----------------------------------------------------------------------------
-- 2) RLS (mesmo só edge function usando, defesa em profundidade)
-- ----------------------------------------------------------------------------
alter table public.smart_anexos_cache enable row level security;

-- Service role já bypassa RLS, mas declaramos política negando tudo pra
-- usuários autenticados — só edge function (service_role) deve mexer aqui.
drop policy if exists "deny_authenticated_select" on public.smart_anexos_cache;
create policy "deny_authenticated_select"
  on public.smart_anexos_cache for select
  to authenticated
  using (false);

drop policy if exists "deny_authenticated_modify" on public.smart_anexos_cache;
create policy "deny_authenticated_modify"
  on public.smart_anexos_cache for all
  to authenticated
  using (false)
  with check (false);

-- ----------------------------------------------------------------------------
-- 3) Bucket privado smart-anexos
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'smart-anexos',
  'smart-anexos',
  false,                          -- privado; acesso só via signed URL
  10485760,                       -- 10 MB de limite por arquivo
  array['application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Bucket privado: só service_role manipula. Cliente final recebe signed URL.
-- Não criamos política pública de SELECT.

-- ----------------------------------------------------------------------------
-- 4) Feature flag em cobranca_settings (origem do PDF: scraper ou official)
-- ----------------------------------------------------------------------------
-- Assume que cobranca_settings já existe com pelo menos uma linha.
-- Se a tabela não existir ainda, ignora silenciosamente — outra migration cria.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'cobranca_settings'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name   = 'cobranca_settings'
        and column_name  = 'smart_pdf_source'
    ) then
      alter table public.cobranca_settings
        add column smart_pdf_source text not null default 'scraper'
          check (smart_pdf_source in ('scraper', 'official', 'disabled'));

      comment on column public.cobranca_settings.smart_pdf_source is
        'Origem do PDF de boleto/NF: scraper (worker VPS), official (API v2 oficial quando liberada) ou disabled.';
    end if;
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- 5) Tabela de jobs de pre-fetch (controle do cron diário)
-- ----------------------------------------------------------------------------
create table if not exists public.smart_scraper_prefetch_jobs (
  id              uuid        primary key default gen_random_uuid(),
  scheduled_for   timestamptz not null,
  titulo_id       text        not null,
  tipo            text        not null check (tipo in ('boleto', 'nf')),
  status          text        not null default 'queued'
                  check (status in ('queued', 'processing', 'done', 'failed', 'skipped_cache_hit')),
  attempts        integer     not null default 0,
  error_code      text,
  error_message   text,
  duration_ms     integer,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  unique (scheduled_for, titulo_id, tipo)
);

create index if not exists idx_prefetch_jobs_status
  on public.smart_scraper_prefetch_jobs (status, scheduled_for);

alter table public.smart_scraper_prefetch_jobs enable row level security;
drop policy if exists "deny_authenticated_all" on public.smart_scraper_prefetch_jobs;
create policy "deny_authenticated_all"
  on public.smart_scraper_prefetch_jobs for all
  to authenticated using (false) with check (false);

comment on table public.smart_scraper_prefetch_jobs is
  'Fila do pre-fetch de boletos/NFs antes da régua disparar cobranças. Populada por edge smart-scraper-prefetch.';

-- ----------------------------------------------------------------------------
-- 6) Função: invalidar cache de um título (chamada pela edge quando detecta
--    source_updated_at mais novo que o cacheado)
-- ----------------------------------------------------------------------------
create or replace function public.smart_anexos_invalidate(p_titulo_id text, p_tipo text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.smart_anexos_cache
   where titulo_id = p_titulo_id
     and (p_tipo is null or tipo = p_tipo);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.smart_anexos_invalidate(text, text) from public, anon, authenticated;
-- Service role usa por padrão; deixamos só ele executar.

-- ----------------------------------------------------------------------------
-- 7) pg_cron: limpeza diária de anexos expirados
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Remove agendamento anterior se existir.
    perform cron.unschedule(jobid)
      from cron.job
     where jobname = 'smart-anexos-cleanup-expired';

    perform cron.schedule(
      'smart-anexos-cleanup-expired',
      '15 3 * * *',                       -- 03:15 UTC todo dia
      $cron$
        delete from public.smart_anexos_cache where expires_at < now();
      $cron$
    );
  end if;
end
$$;

-- NOTE: a remoção física dos arquivos do bucket é feita por uma edge function
-- separada (cleanup-anexos-expirados) que pode ser chamada pelo mesmo cron via
-- pg_net, ou rodada manualmente. Apenas deletar a linha do cache não apaga o
-- arquivo do Storage.

-- ----------------------------------------------------------------------------
-- 8) View pra observabilidade simples
-- ----------------------------------------------------------------------------
create or replace view public.smart_anexos_stats as
select
  tipo,
  count(*)                                      as total,
  count(*) filter (where expires_at > now())    as ativos,
  count(*) filter (where expires_at <= now())   as expirados,
  sum(bytes)                                    as bytes_total,
  sum(hit_count)                                as hits_total,
  min(fetched_at)                               as mais_antigo,
  max(fetched_at)                               as mais_recente
from public.smart_anexos_cache
group by tipo;

grant select on public.smart_anexos_stats to service_role;
