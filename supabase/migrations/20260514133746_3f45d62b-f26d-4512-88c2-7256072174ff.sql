CREATE TABLE public.nfe_monitoramento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chave_acesso TEXT NOT NULL CHECK (length(chave_acesso) = 44),
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  ultima_consulta_em TIMESTAMPTZ,
  ultimo_resultado JSONB,
  solicitacao_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, chave_acesso)
);

CREATE INDEX idx_nfe_monit_user ON public.nfe_monitoramento(user_id);
CREATE INDEX idx_nfe_monit_chave ON public.nfe_monitoramento(chave_acesso);

ALTER TABLE public.nfe_monitoramento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own NFe monit" ON public.nfe_monitoramento
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own NFe monit" ON public.nfe_monitoramento
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own NFe monit" ON public.nfe_monitoramento
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own NFe monit" ON public.nfe_monitoramento
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_nfe_monit_updated
  BEFORE UPDATE ON public.nfe_monitoramento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.nfe_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave_acesso TEXT NOT NULL,
  tipo_evento TEXT,
  descricao TEXT,
  data_evento TIMESTAMPTZ,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nfe_eventos_chave ON public.nfe_eventos(chave_acesso);

ALTER TABLE public.nfe_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own NFe events" ON public.nfe_eventos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.nfe_monitoramento m
      WHERE m.chave_acesso = nfe_eventos.chave_acesso
        AND m.user_id = auth.uid()
    )
  );