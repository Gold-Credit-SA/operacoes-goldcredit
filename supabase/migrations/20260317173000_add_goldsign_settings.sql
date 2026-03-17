CREATE TABLE IF NOT EXISTS public.goldsign_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gold_credit_cert_subject_cn TEXT,
  gold_credit_cert_document TEXT,
  gold_credit_cert_serial_number TEXT,
  gold_credit_cert_tipo TEXT,
  gold_credit_cert_issuer_cn TEXT,
  gold_credit_cert_linked_by UUID,
  gold_credit_cert_linked_by_email TEXT,
  gold_credit_cert_linked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.goldsign_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.goldsign_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage goldsign settings"
    ON public.goldsign_settings FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
