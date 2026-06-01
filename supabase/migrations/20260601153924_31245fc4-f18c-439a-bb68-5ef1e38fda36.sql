CREATE TABLE public.cobranca_settings (
  id integer PRIMARY KEY DEFAULT 1,
  boleto_url_template text,
  nf_url_template text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT cobranca_settings_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.cobranca_settings TO authenticated;
GRANT ALL ON public.cobranca_settings TO service_role;

ALTER TABLE public.cobranca_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view settings" ON public.cobranca_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated upsert settings" ON public.cobranca_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated update settings" ON public.cobranca_settings
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

INSERT INTO public.cobranca_settings (id) VALUES (1) ON CONFLICT DO NOTHING;