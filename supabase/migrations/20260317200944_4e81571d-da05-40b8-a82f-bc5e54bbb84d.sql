CREATE TABLE IF NOT EXISTS public.goldsign_settings (
  id integer PRIMARY KEY DEFAULT 1,
  gold_credit_cert_subject_cn text,
  gold_credit_cert_document text,
  gold_credit_cert_serial_number text,
  gold_credit_cert_tipo text,
  gold_credit_cert_issuer_cn text,
  gold_credit_cert_linked_by uuid,
  gold_credit_cert_linked_by_email text,
  gold_credit_cert_linked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT goldsign_settings_singleton_id CHECK (id = 1)
);

ALTER TABLE public.goldsign_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'goldsign_settings'
      AND policyname = 'Service role can manage goldsign settings'
  ) THEN
    CREATE POLICY "Service role can manage goldsign settings"
    ON public.goldsign_settings
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

INSERT INTO public.goldsign_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;