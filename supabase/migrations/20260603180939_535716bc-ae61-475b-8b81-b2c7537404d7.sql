
CREATE TABLE public.crm_prospect_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL UNIQUE,
  empresa text,
  sent_by uuid,
  sent_by_name text,
  origem text NOT NULL DEFAULT 'operacional',
  scr_history_id uuid,
  request_payload jsonb,
  response_payload jsonb,
  sent_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.crm_prospect_sends TO authenticated;
GRANT ALL ON public.crm_prospect_sends TO service_role;

ALTER TABLE public.crm_prospect_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view prospect sends"
  ON public.crm_prospect_sends FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert prospect sends"
  ON public.crm_prospect_sends FOR INSERT TO authenticated WITH CHECK (auth.uid() = sent_by);
