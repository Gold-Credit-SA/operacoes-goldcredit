
-- Sessions table
CREATE TABLE public.credit_analysis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  client_cpf_cnpj text NOT NULL,
  client_name text,
  cedente_cpf_cnpj text,
  cedente_nome text,
  cedente_data jsonb,
  documents jsonb DEFAULT '[]'::jsonb,
  client_consultations jsonb,
  initial_analysis jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_analysis_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sessions" ON public.credit_analysis_sessions
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert sessions" ON public.credit_analysis_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update sessions" ON public.credit_analysis_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- Messages table
CREATE TABLE public.credit_analysis_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.credit_analysis_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_analysis_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view messages" ON public.credit_analysis_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.credit_analysis_sessions s WHERE s.id = session_id AND auth.uid() IS NOT NULL)
  );

CREATE POLICY "Authenticated users can insert messages" ON public.credit_analysis_messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.credit_analysis_sessions s WHERE s.id = session_id AND s.created_by = auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER update_credit_analysis_sessions_updated_at
  BEFORE UPDATE ON public.credit_analysis_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
