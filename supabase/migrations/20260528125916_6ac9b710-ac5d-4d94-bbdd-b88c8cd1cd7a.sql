
CREATE TABLE public.scr_query_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  doc_id TEXT NOT NULL,
  consulta_type TEXT NOT NULL,
  base_date_initial TEXT,
  base_date_final TEXT,
  uuid_type_scr TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  trace_id TEXT,
  hbi_uuid_query TEXT,
  raw_response JSONB,
  parsed_response JSONB,
  error_code TEXT,
  error_message TEXT,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scr_query_jobs_dedup ON public.scr_query_jobs (doc_id, consulta_type, created_at DESC);
CREATE INDEX idx_scr_query_jobs_user ON public.scr_query_jobs (user_id, created_at DESC);
CREATE INDEX idx_scr_query_jobs_status ON public.scr_query_jobs (status);

GRANT SELECT, INSERT, UPDATE ON public.scr_query_jobs TO authenticated;
GRANT ALL ON public.scr_query_jobs TO service_role;

ALTER TABLE public.scr_query_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own scr jobs"
  ON public.scr_query_jobs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own scr jobs"
  ON public.scr_query_jobs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users update own scr jobs"
  ON public.scr_query_jobs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER scr_query_jobs_updated_at
  BEFORE UPDATE ON public.scr_query_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
