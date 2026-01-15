-- Tabelas de Referência (Lookups)

-- 1. Grupos de Análise VADU
CREATE TABLE public.grupos_analise_vadu (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  id_grupo_analise_vadu VARCHAR(50),
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Operadores
CREATE TABLE public.operadores (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  id_operador VARCHAR(50),
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Regimes Tributários
CREATE TABLE public.regimes_tributarios (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  id_regime_tributario VARCHAR(10),
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Estados Civis
CREATE TABLE public.estados_civis (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  id_estado_civil VARCHAR(10),
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Fontes de Captação
CREATE TABLE public.fontes_captacao (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  id_fonte_captacao VARCHAR(50),
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Gerentes
CREATE TABLE public.gerentes (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  id_gerente VARCHAR(50),
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Controladores
CREATE TABLE public.controladores (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  id_controlador VARCHAR(50),
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Contas Bancárias
CREATE TABLE public.contas_bancarias (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  descricao TEXT,
  num_conta VARCHAR(100),
  escrow INTEGER,
  cpf_cnpj_cedente_escrow VARCHAR(50),
  nome_cedente_escrow TEXT,
  num_carteiras TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Paginations (controle de sincronização)
CREATE TABLE public.paginations (
  id SERIAL PRIMARY KEY,
  tabela VARCHAR(255),
  page VARCHAR(50),
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabelas Principais

-- 10. Cedentes Completo (nova tabela com todos os campos)
CREATE TABLE public.cedentes_completo (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  nome TEXT,
  cpf_cnpj VARCHAR(50),
  endereco TEXT,
  cep VARCHAR(20),
  cidade VARCHAR(100),
  uf VARCHAR(10),
  email TEXT,
  telefone TEXT,
  gerente TEXT,
  operador TEXT,
  captador TEXT,
  controlador TEXT,
  fator DECIMAL(10,2),
  advalorem DECIMAL(10,2),
  data_cadastro DATE,
  fonte_captacao TEXT,
  setor TEXT,
  grupo_economico TEXT,
  bloqueado VARCHAR(10),
  primeira_operacao VARCHAR(50),
  risco_atual DECIMAL(15,2),
  saldo DECIMAL(15,2),
  vencimento_contrato VARCHAR(50),
  limite_global DECIMAL(15,2),
  limite_boleto_especial DECIMAL(15,2),
  limite_comissaria DECIMAL(15,2),
  limite_tranche DECIMAL(15,2),
  limite_boleto_especial_tranche DECIMAL(15,2),
  limite_boleto_garantido DECIMAL(15,2),
  limite_operacao_clean DECIMAL(15,2),
  id_cedente VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 11. Operações Individualizadas
CREATE TABLE public.operacoes_individualizadas (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  operacao VARCHAR(50),
  etapa VARCHAR(100),
  data DATE,
  cedente TEXT,
  cpf_cnpj_cedente VARCHAR(50),
  valor_bruto DECIMAL(15,2),
  valor_taxa DECIMAL(15,2),
  prazo_medio DECIMAL(10,2),
  valor_tarifa DECIMAL(15,2),
  valor_iof DECIMAL(15,2),
  valor_pendencia DECIMAL(15,2),
  valor_liquido DECIMAL(15,2),
  cred_cedente DECIMAL(15,2),
  valor_recompra_repass DECIMAL(15,2),
  valor_pagto_operacao DECIMAL(15,2),
  valor_saldo DECIMAL(15,2),
  valor_receita DECIMAL(15,2),
  finalizacao DATE,
  nfse TEXT,
  iss DECIMAL(15,2),
  operador TEXT,
  captador TEXT,
  pagamento_operacao DATE,
  inicio DATE,
  conta_pagto TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 12. Receita por Cedente
CREATE TABLE public.receita_por_cedente (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  cedente TEXT,
  cpf_cnpj VARCHAR(50),
  data_pagamento DATE,
  modalidade VARCHAR(10),
  despesas_bancarias DECIMAL(15,2),
  taxa DECIMAL(15,2),
  desagio DECIMAL(15,2),
  tarifas DECIMAL(15,2),
  taxas_administrativas DECIMAL(15,2),
  multas DECIMAL(15,2),
  juros DECIMAL(15,2),
  total DECIMAL(15,2),
  desconto DECIMAL(15,2),
  porcentagem DECIMAL(10,2),
  operador TEXT,
  captador TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 13. Títulos em Aberto
CREATE TABLE public.titulos_em_aberto (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  id_titulo VARCHAR(50),
  documento VARCHAR(100),
  conf VARCHAR(50),
  etapa VARCHAR(50),
  cr VARCHAR(10),
  m VARCHAR(10),
  tipo VARCHAR(20),
  cpf_cnpj_sacado VARCHAR(50),
  sacado TEXT,
  cpf_cnpj_cedente VARCHAR(50),
  cedente TEXT,
  nosso_numero VARCHAR(100),
  data_emissao DATE,
  original DATE,
  vencimento DATE,
  situacao VARCHAR(50),
  op VARCHAR(50),
  conta VARCHAR(100),
  valor DECIMAL(15,2),
  valor_multa DECIMAL(15,2),
  valor_juros DECIMAL(15,2),
  valor_tarifas DECIMAL(15,2),
  valor_total DECIMAL(15,2),
  historico TEXT,
  motivo TEXT,
  id_titulo_original VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 14. Títulos Prorrogados
CREATE TABLE public.titulos_prorrogados (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  numero VARCHAR(100),
  m VARCHAR(10),
  tipo VARCHAR(20),
  cpf_cnpj_sacado VARCHAR(50),
  sacado TEXT,
  cpf_cnpj_cedente VARCHAR(50),
  cedente TEXT,
  vencimento DATE,
  emissao DATE,
  conta VARCHAR(100),
  valor_face DECIMAL(15,2),
  vencimento_anterior DATE,
  valor_face_anterior DECIMAL(15,2),
  tarifas DECIMAL(15,2),
  juros DECIMAL(15,2),
  multa DECIMAL(15,2),
  iof DECIMAL(15,2),
  conf VARCHAR(50),
  etapa VARCHAR(50),
  data_prorrogacao INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 15. Títulos Quitados
CREATE TABLE public.titulos_quitados (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  numero VARCHAR(100),
  m VARCHAR(10),
  classe_risco TEXT,
  tipo VARCHAR(20),
  cpf_cnpj_sacado VARCHAR(50),
  sacado TEXT,
  cpf_cnpj_cedente VARCHAR(50),
  cedente TEXT,
  nosso_numero VARCHAR(100),
  original DATE,
  vencimento DATE,
  quitacao DATE,
  status VARCHAR(10),
  emissao DATE,
  valor_face DECIMAL(15,2),
  valor_juros DECIMAL(15,2),
  valor_multa DECIMAL(15,2),
  valor_tarifas DECIMAL(15,2),
  valor_desconto DECIMAL(15,2),
  valor_total DECIMAL(15,2),
  valor_liquidado DECIMAL(15,2),
  op VARCHAR(50),
  situacao VARCHAR(100),
  tipo_quitacao VARCHAR(100),
  data_custodia DATE,
  op_de_pagamento VARCHAR(50),
  observacao TEXT,
  conta VARCHAR(100),
  valor_tar_dev_cheque DECIMAL(15,2),
  valor_tar_recompra DECIMAL(15,2),
  categoria TEXT,
  banco_cobrador TEXT,
  agencia_cobradora VARCHAR(50),
  motivo_devolucao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 16. Títulos Quitados com Suspeita de Fraude
CREATE TABLE public.titulos_quitados_suspeita_fraude (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  numero_documento VARCHAR(100),
  vencimento DATE,
  valor DECIMAL(15,2),
  data_quitacao DATE,
  sacado TEXT,
  cpf_cnpj_sacado VARCHAR(50),
  cedente TEXT,
  cpf_cnpj_cedente VARCHAR(50),
  banco_cobrador TEXT,
  agencia_cobradora VARCHAR(50),
  praca_pagamento TEXT,
  localidade_sacado TEXT,
  criticas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 17. Títulos Recomprados
CREATE TABLE public.titulos_recomprados (
  id SERIAL PRIMARY KEY,
  dev_id INTEGER,
  dev_created_at TIMESTAMP WITH TIME ZONE,
  dev_updated_at TIMESTAMP WITH TIME ZONE,
  numero VARCHAR(100),
  m VARCHAR(10),
  classe_risco VARCHAR(10),
  tipo VARCHAR(20),
  cpf_cnpj_sacado VARCHAR(50),
  sacado TEXT,
  cpf_cnpj_cedente VARCHAR(50),
  cedente TEXT,
  nosso_numero VARCHAR(100),
  vencimento DATE,
  recompra DATE,
  emissao DATE,
  valor_face DECIMAL(15,2),
  juros DECIMAL(15,2),
  multa DECIMAL(15,2),
  desconto DECIMAL(15,2),
  tarifa DECIMAL(15,2),
  total DECIMAL(15,2),
  liquidado DECIMAL(15,2),
  op VARCHAR(50),
  situacao VARCHAR(100),
  op_de_pagamento VARCHAR(50),
  observacao TEXT,
  conta VARCHAR(100),
  categoria TEXT,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.grupos_analise_vadu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regimes_tributarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estados_civis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fontes_captacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gerentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controladores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paginations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cedentes_completo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_individualizadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receita_por_cedente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titulos_em_aberto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titulos_prorrogados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titulos_quitados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titulos_quitados_suspeita_fraude ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titulos_recomprados ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para leitura pública
CREATE POLICY "Leitura pública grupos_analise_vadu" ON public.grupos_analise_vadu FOR SELECT USING (true);
CREATE POLICY "Leitura pública operadores" ON public.operadores FOR SELECT USING (true);
CREATE POLICY "Leitura pública regimes_tributarios" ON public.regimes_tributarios FOR SELECT USING (true);
CREATE POLICY "Leitura pública estados_civis" ON public.estados_civis FOR SELECT USING (true);
CREATE POLICY "Leitura pública fontes_captacao" ON public.fontes_captacao FOR SELECT USING (true);
CREATE POLICY "Leitura pública gerentes" ON public.gerentes FOR SELECT USING (true);
CREATE POLICY "Leitura pública controladores" ON public.controladores FOR SELECT USING (true);
CREATE POLICY "Leitura pública contas_bancarias" ON public.contas_bancarias FOR SELECT USING (true);
CREATE POLICY "Leitura pública paginations" ON public.paginations FOR SELECT USING (true);
CREATE POLICY "Leitura pública cedentes_completo" ON public.cedentes_completo FOR SELECT USING (true);
CREATE POLICY "Leitura pública operacoes_individualizadas" ON public.operacoes_individualizadas FOR SELECT USING (true);
CREATE POLICY "Leitura pública receita_por_cedente" ON public.receita_por_cedente FOR SELECT USING (true);
CREATE POLICY "Leitura pública titulos_em_aberto" ON public.titulos_em_aberto FOR SELECT USING (true);
CREATE POLICY "Leitura pública titulos_prorrogados" ON public.titulos_prorrogados FOR SELECT USING (true);
CREATE POLICY "Leitura pública titulos_quitados" ON public.titulos_quitados FOR SELECT USING (true);
CREATE POLICY "Leitura pública titulos_quitados_suspeita_fraude" ON public.titulos_quitados_suspeita_fraude FOR SELECT USING (true);
CREATE POLICY "Leitura pública titulos_recomprados" ON public.titulos_recomprados FOR SELECT USING (true);

-- Políticas para INSERT público
CREATE POLICY "Insert público grupos_analise_vadu" ON public.grupos_analise_vadu FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público operadores" ON public.operadores FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público regimes_tributarios" ON public.regimes_tributarios FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público estados_civis" ON public.estados_civis FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público fontes_captacao" ON public.fontes_captacao FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público gerentes" ON public.gerentes FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público controladores" ON public.controladores FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público contas_bancarias" ON public.contas_bancarias FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público paginations" ON public.paginations FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público cedentes_completo" ON public.cedentes_completo FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público operacoes_individualizadas" ON public.operacoes_individualizadas FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público receita_por_cedente" ON public.receita_por_cedente FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público titulos_em_aberto" ON public.titulos_em_aberto FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público titulos_prorrogados" ON public.titulos_prorrogados FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público titulos_quitados" ON public.titulos_quitados FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público titulos_quitados_suspeita_fraude" ON public.titulos_quitados_suspeita_fraude FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert público titulos_recomprados" ON public.titulos_recomprados FOR INSERT WITH CHECK (true);

-- Triggers para updated_at
CREATE TRIGGER update_grupos_analise_vadu_updated_at BEFORE UPDATE ON public.grupos_analise_vadu FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_operadores_updated_at BEFORE UPDATE ON public.operadores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_regimes_tributarios_updated_at BEFORE UPDATE ON public.regimes_tributarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_estados_civis_updated_at BEFORE UPDATE ON public.estados_civis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fontes_captacao_updated_at BEFORE UPDATE ON public.fontes_captacao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gerentes_updated_at BEFORE UPDATE ON public.gerentes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_controladores_updated_at BEFORE UPDATE ON public.controladores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contas_bancarias_updated_at BEFORE UPDATE ON public.contas_bancarias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_paginations_updated_at BEFORE UPDATE ON public.paginations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cedentes_completo_updated_at BEFORE UPDATE ON public.cedentes_completo FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_operacoes_individualizadas_updated_at BEFORE UPDATE ON public.operacoes_individualizadas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_receita_por_cedente_updated_at BEFORE UPDATE ON public.receita_por_cedente FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_titulos_em_aberto_updated_at BEFORE UPDATE ON public.titulos_em_aberto FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_titulos_prorrogados_updated_at BEFORE UPDATE ON public.titulos_prorrogados FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_titulos_quitados_updated_at BEFORE UPDATE ON public.titulos_quitados FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_titulos_quitados_suspeita_fraude_updated_at BEFORE UPDATE ON public.titulos_quitados_suspeita_fraude FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_titulos_recomprados_updated_at BEFORE UPDATE ON public.titulos_recomprados FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_operacoes_individualizadas_cedente ON public.operacoes_individualizadas(cpf_cnpj_cedente);
CREATE INDEX idx_operacoes_individualizadas_data ON public.operacoes_individualizadas(data);
CREATE INDEX idx_receita_por_cedente_cpf_cnpj ON public.receita_por_cedente(cpf_cnpj);
CREATE INDEX idx_receita_por_cedente_data ON public.receita_por_cedente(data_pagamento);
CREATE INDEX idx_titulos_em_aberto_cedente ON public.titulos_em_aberto(cpf_cnpj_cedente);
CREATE INDEX idx_titulos_em_aberto_vencimento ON public.titulos_em_aberto(vencimento);
CREATE INDEX idx_titulos_quitados_cedente ON public.titulos_quitados(cpf_cnpj_cedente);
CREATE INDEX idx_titulos_quitados_quitacao ON public.titulos_quitados(quitacao);
CREATE INDEX idx_titulos_recomprados_cedente ON public.titulos_recomprados(cpf_cnpj_cedente);
CREATE INDEX idx_cedentes_completo_cpf_cnpj ON public.cedentes_completo(cpf_cnpj);