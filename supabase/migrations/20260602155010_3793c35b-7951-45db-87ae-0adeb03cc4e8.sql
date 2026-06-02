-- ============================================================================
-- Smart Scraper — cache de anexos (boleto/NF) + bucket + feature flag + cron
-- ============================================================================

create table if not exists public.smart_anexos_cache (
  titulo_id              text        not null,
  tipo                   text        not null check (tipo in ('boleto', 'nf')),
  storage_path           text        not null,
  bytes                  integer     not null check (bytes > 0),
  fetched_at             timestamptz not null default now(),
  expires_at             timestamptz not null,
  source_updated_at      timestamptz,
  source_status          text,
  last_requested_by      uuid,
  hit_count              integer     not null default 0,
  primary key (titulo_id, tipo)
);

create index if not exists idx_smart_anexos_expires_at
  on public.smart_anexos_cache (expires_at);

create index if not exists idx_smart_anexos_fetched_at
  on public.smart_anexos_cache (fetched_at);

comment on table public.smart_anexos_cache is
  'Cache de boletos/NFs baixados do portal Smart via scraping.';

grant select, insert, update, delete on public.smart_anexos_cache to service_role;

alter table public.smart_anexos_cache enable row level security;

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

-- Feature flag em cobranca_settings
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
    end if;
  end if;
end
$$;

-- Tabela de jobs de pre-fetch
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

grant select, insert, update, delete on public.smart_scraper_prefetch_jobs to service_role;

alter table public.smart_scraper_prefetch_jobs enable row level security;
drop policy if exists "deny_authenticated_all" on public.smart_scraper_prefetch_jobs;
create policy "deny_authenticated_all"
  on public.smart_scraper_prefetch_jobs for all
  to authenticated using (false) with check (false);

-- Função: invalidar cache de um título
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

-- pg_cron: limpeza diária
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job
     where jobname = 'smart-anexos-cleanup-expired';

    perform cron.schedule(
      'smart-anexos-cleanup-expired',
      '15 3 * * *',
      $cron$
        delete from public.smart_anexos_cache where expires_at < now();
      $cron$
    );
  end if;
end
$$;

-- View pra observabilidade
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

-- ============================================================================
-- Migration 2: extra_key column
-- ============================================================================
alter table public.smart_anexos_cache
  add column if not exists extra_key text;

create index if not exists idx_smart_anexos_extra_key
  on public.smart_anexos_cache (extra_key);

comment on column public.smart_anexos_cache.extra_key is
  'Hash SHA-256 (16 chars) determinístico do payload extra.';
