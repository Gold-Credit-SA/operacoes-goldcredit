
-- Create storage bucket for consulta PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('consulta-pdfs', 'consulta-pdfs', false);

-- Create consulta history table
CREATE TABLE public.consulta_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'serasa', 'scr', 'agrisk'
  consulta_type TEXT NOT NULL,
  consulta_label TEXT NOT NULL,
  pdf_path TEXT,
  result_data JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consulta_history ENABLE ROW LEVEL SECURITY;

-- Users can see their own consultas
CREATE POLICY "Users can view own consulta history"
  ON public.consulta_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own consultas
CREATE POLICY "Users can insert own consulta history"
  ON public.consulta_history FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can view all consulta history"
  ON public.consulta_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage policies for consulta-pdfs bucket
CREATE POLICY "Auth users can upload consulta PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'consulta-pdfs');

CREATE POLICY "Auth users can read own consulta PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'consulta-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);
