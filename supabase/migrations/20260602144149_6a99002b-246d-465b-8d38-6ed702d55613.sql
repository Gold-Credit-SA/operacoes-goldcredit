-- ============================================================================
-- Smart Scraper — adiciona coluna extra_key em smart_anexos_cache.
-- ----------------------------------------------------------------------------
-- Motivo: descobrimos no deploy real que o boleto do portal Smart depende de
-- um identificador chamado `checks` (ex: '21467,'), passado em
-- `body.extra.checks`. Sem coluna pra diferenciar, dois `checks` diferentes
-- pro mesmo titulo_id compartilhavam cache silenciosamente.
--
-- A edge function passa a calcular SHA-256 truncado de `extra` e usar como
-- chave de invalidação adicional. Coluna é nullable: NFs (que não usam extra)
-- continuam com NULL.
-- ============================================================================

alter table public.smart_anexos_cache
  add column if not exists extra_key text;

create index if not exists idx_smart_anexos_extra_key
  on public.smart_anexos_cache (extra_key);

comment on column public.smart_anexos_cache.extra_key is
  'Hash SHA-256 (16 chars) determinístico do payload `extra` enviado pelo cliente. Usado pra invalidar cache quando campos extras mudam (ex: `checks` do boleto trocou).';
