-- ============================================================
-- Camada compartilhada de integrações pagas: observabilidade,
-- cache, idempotência e polling persistente do SCR.
-- ============================================================

-- ------------------------------------------------------------
-- integration_logs: registro estruturado de toda chamada a
-- provedor externo (autenticação, query, poll, get-result).
-- Usado para auditoria de custo, diagnóstico de erros e
-- reprocessamento (response_excerpt preserva o payload bruto).
-- ------------------------------------------------------------
CREATE TABLE public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trace_id TEXT,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  doc_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('success','user_error','provider_error','network_error','cache_hit','dedup_hit')),
  http_status INTEGER,
  latency_ms INTEGER,
  cost_cents INTEGER,
  error_code TEXT,
  error_message TEXT,
  request_hash TEXT,
  request_excerpt JSONB,
  response_excerpt JSONB,
  consulta_history_id UUID REFERENCES public.consulta_history(id) ON DELETE SET NULL
);

CREATE INDEX idx_integration_logs_provider_created ON public.integration_logs(provider, created_at DESC);
CREATE INDEX idx_integration_logs_doc_created ON public.integration_logs(doc_id, created_at DESC) WHERE doc_id IS NOT NULL;
CREATE INDEX idx_integration_logs_hash ON public.integration_logs(request_hash) WHERE request_hash IS NOT NULL;
CREATE INDEX idx_integration_logs_errors ON public.integration_logs(provider, status, created_at DESC) WHERE status <> 'success';
CREATE INDEX idx_integration_logs_trace ON public.integration_logs(trace_id) WHERE trace_id IS NOT NULL;

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view integration logs"
  ON public.integration_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Edge functions usam service_role e bypass de RLS para INSERT.

-- ------------------------------------------------------------
-- integration_cache: cache de respostas por hash determinístico.
-- Reduz consultas pagas duplicadas (mesmo doc + mesma data-base
-- dentro do TTL configurado). TTL definido por inserção.
-- ------------------------------------------------------------
CREATE TABLE public.integration_cache (
  hash TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  doc_id TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_integration_cache_expires ON public.integration_cache(expires_at);
CREATE INDEX idx_integration_cache_provider ON public.integration_cache(provider, created_at DESC);

ALTER TABLE public.integration_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view integration cache"
  ON public.integration_cache FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------
-- scr_query_jobs: estado persistente de cada consulta SCR.
-- Permite polling em background (cron job) sem estourar o
-- timeout de 60s do Edge, e preserva a resposta crua da HBI
-- para reprocessamento sem nova chamada paga.
-- ------------------------------------------------------------
CREATE TABLE public.scr_query_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  doc_id TEXT NOT NULL,
  consulta_type TEXT NOT NULL CHECK (consulta_type IN ('AVULSA','COMPARATIVO','DETALHADA')),
  base_date_initial TEXT NOT NULL,
  base_date_final TEXT,
  uuid_type_scr TEXT,
  hbi_uuid_query TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','dispatched','polling','completed','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_polled_at TIMESTAMPTZ,
  raw_response JSONB,
  parsed_response JSONB,
  error_code TEXT,
  error_message TEXT,
  consulta_history_id UUID REFERENCES public.consulta_history(id) ON DELETE SET NULL,
  trace_id TEXT
);

CREATE INDEX idx_scr_jobs_polling ON public.scr_query_jobs(status, last_polled_at)
  WHERE status IN ('dispatched','polling');
CREATE INDEX idx_scr_jobs_doc ON public.scr_query_jobs(doc_id, created_at DESC);
CREATE INDEX idx_scr_jobs_user ON public.scr_query_jobs(user_id, created_at DESC);
CREATE INDEX idx_scr_jobs_uuid ON public.scr_query_jobs(hbi_uuid_query) WHERE hbi_uuid_query IS NOT NULL;

ALTER TABLE public.scr_query_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own scr jobs"
  ON public.scr_query_jobs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all scr jobs"
  ON public.scr_query_jobs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para manter updated_at em sync.
CREATE OR REPLACE FUNCTION public.scr_query_jobs_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_scr_query_jobs_touch
  BEFORE UPDATE ON public.scr_query_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.scr_query_jobs_touch_updated_at();
