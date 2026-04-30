
-- Create table for manager feedback on credit analyses (used as AI learning corpus)
CREATE TABLE public.credit_analysis_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  cedente_cpf_cnpj TEXT,
  cedente_nome TEXT,
  sacados JSONB DEFAULT '[]'::jsonb,
  -- AI's original recommendation snapshot (for comparison/learning)
  ia_decisao TEXT,
  ia_risco TEXT,
  ia_parecer TEXT,
  -- Manager's actual decision
  decisao_final TEXT NOT NULL CHECK (decisao_final IN ('APROVADO', 'APROVADO_COM_RESSALVAS', 'REPROVADO', 'PENDENTE')),
  finalidade TEXT,
  parecer_gestor TEXT NOT NULL,
  observacoes TEXT,
  -- Real outcome (filled later, optional)
  resultado_real TEXT CHECK (resultado_real IN ('PAGO', 'PAGO_COM_ATRASO', 'INADIMPLENTE', 'EM_ANDAMENTO', 'CANCELADO')),
  resultado_observacao TEXT,
  created_by UUID NOT NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_caf_session ON public.credit_analysis_feedback(session_id);
CREATE INDEX idx_caf_cedente ON public.credit_analysis_feedback(cedente_cpf_cnpj);
CREATE INDEX idx_caf_created_at ON public.credit_analysis_feedback(created_at DESC);

ALTER TABLE public.credit_analysis_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view feedback"
ON public.credit_analysis_feedback FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert feedback"
ON public.credit_analysis_feedback FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Author or admin can update feedback"
ON public.credit_analysis_feedback FOR UPDATE
TO authenticated
USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete feedback"
ON public.credit_analysis_feedback FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_caf_updated_at
BEFORE UPDATE ON public.credit_analysis_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
