CREATE TABLE public.cobranca_envios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT,
  sacado_cpf_cnpj TEXT NOT NULL,
  sacado_nome TEXT,
  cedente_cpf_cnpj TEXT,
  cedente_nome TEXT,
  telefone TEXT NOT NULL,
  numero_titulo TEXT,
  valor NUMERIC,
  vencimento DATE,
  dias_atraso INT,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado',
  evolution_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.cobranca_envios TO authenticated;
GRANT ALL ON public.cobranca_envios TO service_role;

ALTER TABLE public.cobranca_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all envios"
  ON public.cobranca_envios FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own envios"
  ON public.cobranca_envios FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_cobranca_envios_created ON public.cobranca_envios(created_at DESC);
CREATE INDEX idx_cobranca_envios_sacado ON public.cobranca_envios(sacado_cpf_cnpj);

CREATE TABLE public.cobranca_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobranca_templates TO authenticated;
GRANT ALL ON public.cobranca_templates TO service_role;

ALTER TABLE public.cobranca_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view templates"
  ON public.cobranca_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert templates"
  ON public.cobranca_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or admin can update templates"
  ON public.cobranca_templates FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creator or admin can delete templates"
  ON public.cobranca_templates FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER cobranca_templates_updated_at
  BEFORE UPDATE ON public.cobranca_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.cobranca_templates (nome, mensagem, created_by)
SELECT 'Padrão - Lembrete', E'Olá {{sacado_nome}}, tudo bem?\n\nIdentificamos que o título nº {{numero_titulo}}, no valor de R$ {{valor}}, com vencimento em {{vencimento}}, está em atraso há {{dias_atraso}} dias.\n\nPor favor, entre em contato para regularizar.\n\nObrigado.',
  (SELECT user_id FROM public.profiles WHERE email = 'renan@goldcreditsa.com.br' LIMIT 1)
WHERE EXISTS (SELECT 1 FROM public.profiles WHERE email = 'renan@goldcreditsa.com.br');