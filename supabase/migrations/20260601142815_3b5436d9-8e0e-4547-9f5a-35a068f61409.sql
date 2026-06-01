
DO $$ BEGIN
  CREATE TYPE public.cobranca_status AS ENUM (
    'em_dia','notificado','em_negociacao','acordo','protestado','quitado','incobravel'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.cobranca_envios
  ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS email_destinatario text,
  ADD COLUMN IF NOT EXISTS assunto text;

ALTER TABLE public.cobranca_templates
  ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS assunto text;

CREATE TABLE IF NOT EXISTS public.cobranca_regua (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  dias_min integer NOT NULL,
  dias_max integer,
  canal text NOT NULL DEFAULT 'whatsapp',
  template_id uuid REFERENCES public.cobranca_templates(id) ON DELETE SET NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobranca_regua TO authenticated;
GRANT ALL ON public.cobranca_regua TO service_role;
ALTER TABLE public.cobranca_regua ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated view regua" ON public.cobranca_regua;
CREATE POLICY "Authenticated view regua" ON public.cobranca_regua FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert regua" ON public.cobranca_regua;
CREATE POLICY "Authenticated insert regua" ON public.cobranca_regua FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Creator or admin update regua" ON public.cobranca_regua;
CREATE POLICY "Creator or admin update regua" ON public.cobranca_regua FOR UPDATE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Creator or admin delete regua" ON public.cobranca_regua;
CREATE POLICY "Creator or admin delete regua" ON public.cobranca_regua FOR DELETE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS trg_cobranca_regua_updated ON public.cobranca_regua;
CREATE TRIGGER trg_cobranca_regua_updated BEFORE UPDATE ON public.cobranca_regua FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.cobranca_titulo_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cedente_cpf_cnpj text NOT NULL,
  numero_titulo text NOT NULL,
  sacado_cpf_cnpj text,
  sacado_nome text,
  status public.cobranca_status NOT NULL DEFAULT 'em_dia',
  ultimo_contato_at timestamptz,
  proximo_contato_at timestamptz,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cedente_cpf_cnpj, numero_titulo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobranca_titulo_status TO authenticated;
GRANT ALL ON public.cobranca_titulo_status TO service_role;
ALTER TABLE public.cobranca_titulo_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated view status" ON public.cobranca_titulo_status;
CREATE POLICY "Authenticated view status" ON public.cobranca_titulo_status FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated upsert status" ON public.cobranca_titulo_status;
CREATE POLICY "Authenticated upsert status" ON public.cobranca_titulo_status FOR INSERT TO authenticated WITH CHECK (auth.uid() = updated_by);
DROP POLICY IF EXISTS "Authenticated update status" ON public.cobranca_titulo_status;
CREATE POLICY "Authenticated update status" ON public.cobranca_titulo_status FOR UPDATE TO authenticated USING (true);
DROP TRIGGER IF EXISTS trg_cobranca_status_updated ON public.cobranca_titulo_status;
CREATE TRIGGER trg_cobranca_status_updated BEFORE UPDATE ON public.cobranca_titulo_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.cobranca_promessas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sacado_cpf_cnpj text NOT NULL,
  cedente_cpf_cnpj text,
  numero_titulo text,
  data_prometida date NOT NULL,
  valor_prometido numeric,
  cumprida boolean NOT NULL DEFAULT false,
  observacao text,
  created_by uuid NOT NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobranca_promessas TO authenticated;
GRANT ALL ON public.cobranca_promessas TO service_role;
ALTER TABLE public.cobranca_promessas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated view promessas" ON public.cobranca_promessas;
CREATE POLICY "Authenticated view promessas" ON public.cobranca_promessas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert promessas" ON public.cobranca_promessas;
CREATE POLICY "Authenticated insert promessas" ON public.cobranca_promessas FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Creator or admin update promessas" ON public.cobranca_promessas;
CREATE POLICY "Creator or admin update promessas" ON public.cobranca_promessas FOR UPDATE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Creator or admin delete promessas" ON public.cobranca_promessas;
CREATE POLICY "Creator or admin delete promessas" ON public.cobranca_promessas FOR DELETE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.cobranca_acordos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sacado_cpf_cnpj text NOT NULL,
  sacado_nome text,
  cedente_cpf_cnpj text,
  cedente_nome text,
  titulos_originais jsonb NOT NULL DEFAULT '[]'::jsonb,
  valor_original numeric NOT NULL,
  valor_acordo numeric NOT NULL,
  desconto numeric NOT NULL DEFAULT 0,
  qtd_parcelas integer NOT NULL DEFAULT 1,
  primeiro_vencimento date NOT NULL,
  parcelas jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'ativo',
  observacao text,
  created_by uuid NOT NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobranca_acordos TO authenticated;
GRANT ALL ON public.cobranca_acordos TO service_role;
ALTER TABLE public.cobranca_acordos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated view acordos" ON public.cobranca_acordos;
CREATE POLICY "Authenticated view acordos" ON public.cobranca_acordos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert acordos" ON public.cobranca_acordos;
CREATE POLICY "Authenticated insert acordos" ON public.cobranca_acordos FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Creator or admin update acordos" ON public.cobranca_acordos;
CREATE POLICY "Creator or admin update acordos" ON public.cobranca_acordos FOR UPDATE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Creator or admin delete acordos" ON public.cobranca_acordos;
CREATE POLICY "Creator or admin delete acordos" ON public.cobranca_acordos FOR DELETE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS trg_cobranca_acordos_updated ON public.cobranca_acordos;
CREATE TRIGGER trg_cobranca_acordos_updated BEFORE UPDATE ON public.cobranca_acordos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.cobranca_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sacado_cpf_cnpj text NOT NULL,
  cedente_cpf_cnpj text,
  numero_titulo text,
  conteudo text NOT NULL,
  created_by uuid NOT NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.cobranca_notas TO authenticated;
GRANT ALL ON public.cobranca_notas TO service_role;
ALTER TABLE public.cobranca_notas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated view notas" ON public.cobranca_notas;
CREATE POLICY "Authenticated view notas" ON public.cobranca_notas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert notas" ON public.cobranca_notas;
CREATE POLICY "Authenticated insert notas" ON public.cobranca_notas FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Author or admin delete notas" ON public.cobranca_notas;
CREATE POLICY "Author or admin delete notas" ON public.cobranca_notas FOR DELETE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_cobranca_envios_sacado ON public.cobranca_envios(sacado_cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_cobranca_notas_sacado ON public.cobranca_notas(sacado_cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_cobranca_promessas_sacado ON public.cobranca_promessas(sacado_cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_cobranca_acordos_sacado ON public.cobranca_acordos(sacado_cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_cobranca_status_lookup ON public.cobranca_titulo_status(cedente_cpf_cnpj, numero_titulo);
