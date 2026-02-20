
-- Tabela de sacados (destinatários das NF-e)
CREATE TABLE public.sacados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf_cnpj TEXT NOT NULL,
  nome TEXT NOT NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  email TEXT,
  telefone TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cpf_cnpj)
);

-- Tabela de notas fiscais importadas (vincula cedente + sacado)
CREATE TABLE public.operacao_notas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cedente_cpf_cnpj TEXT NOT NULL,
  cedente_nome TEXT,
  sacado_id UUID REFERENCES public.sacados(id),
  sacado_cpf_cnpj TEXT NOT NULL,
  sacado_nome TEXT,
  numero_nota TEXT,
  serie TEXT,
  chave_acesso TEXT,
  valor NUMERIC,
  data_emissao DATE,
  xml_filename TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sacados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacao_notas ENABLE ROW LEVEL SECURITY;

-- RLS policies for sacados
CREATE POLICY "Authenticated users can view sacados"
ON public.sacados FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert sacados"
ON public.sacados FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update sacados"
ON public.sacados FOR UPDATE
USING (auth.uid() = created_by);

-- RLS policies for operacao_notas
CREATE POLICY "Authenticated users can view notas"
ON public.operacao_notas FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert notas"
ON public.operacao_notas FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete own notas"
ON public.operacao_notas FOR DELETE
USING (auth.uid() = created_by);

-- Trigger for updated_at on sacados
CREATE TRIGGER update_sacados_updated_at
BEFORE UPDATE ON public.sacados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_sacados_cpf_cnpj ON public.sacados(cpf_cnpj);
CREATE INDEX idx_operacao_notas_cedente ON public.operacao_notas(cedente_cpf_cnpj);
CREATE INDEX idx_operacao_notas_sacado ON public.operacao_notas(sacado_cpf_cnpj);
CREATE INDEX idx_operacao_notas_sacado_id ON public.operacao_notas(sacado_id);
