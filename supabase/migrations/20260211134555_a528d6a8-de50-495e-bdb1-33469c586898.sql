
-- Create enum for assignment status
CREATE TYPE public.assignment_status AS ENUM ('pending', 'approved', 'rejected');

-- Create portfolio_assignments table
CREATE TABLE public.portfolio_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cedente_cpf_cnpj TEXT NOT NULL,
  cedente_nome TEXT,
  status assignment_status NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one cedente per gestor
ALTER TABLE public.portfolio_assignments 
  ADD CONSTRAINT unique_user_cedente UNIQUE (user_id, cedente_cpf_cnpj);

-- Enable RLS
ALTER TABLE public.portfolio_assignments ENABLE ROW LEVEL SECURITY;

-- Gestors can view their own assignments
CREATE POLICY "Users can view own assignments"
  ON public.portfolio_assignments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all assignments
CREATE POLICY "Admins can view all assignments"
  ON public.portfolio_assignments
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can request assignments (insert with pending status)
CREATE POLICY "Users can request assignments"
  ON public.portfolio_assignments
  FOR INSERT
  WITH CHECK (auth.uid() = requested_by);

-- Admins can insert assignments directly
CREATE POLICY "Admins can insert assignments"
  ON public.portfolio_assignments
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update assignments (approve/reject)
CREATE POLICY "Admins can update assignments"
  ON public.portfolio_assignments
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete assignments
CREATE POLICY "Admins can delete assignments"
  ON public.portfolio_assignments
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_portfolio_assignments_updated_at
  BEFORE UPDATE ON public.portfolio_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
