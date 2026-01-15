-- Criar tabela de cedentes
CREATE TABLE public.cedentes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255),
  razao_social VARCHAR(255),
  cnpj VARCHAR(18),
  cpf VARCHAR(14),
  email VARCHAR(255),
  telefone VARCHAR(50),
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(10),
  banco VARCHAR(100),
  agencia VARCHAR(20),
  conta VARCHAR(30),
  status VARCHAR(50) DEFAULT 'Ativo',
  data_cadastro TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cedentes ENABLE ROW LEVEL SECURITY;

-- Política pública de leitura (consulta aberta)
CREATE POLICY "Cedentes são públicos para leitura"
  ON public.cedentes
  FOR SELECT
  USING (true);

-- Política pública de inserção (para importação)
CREATE POLICY "Permitir inserção pública de cedentes"
  ON public.cedentes
  FOR INSERT
  WITH CHECK (true);

-- Política pública de atualização
CREATE POLICY "Permitir atualização pública de cedentes"
  ON public.cedentes
  FOR UPDATE
  USING (true);

-- Política pública de deleção
CREATE POLICY "Permitir deleção pública de cedentes"
  ON public.cedentes
  FOR DELETE
  USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_cedentes_updated_at
  BEFORE UPDATE ON public.cedentes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();