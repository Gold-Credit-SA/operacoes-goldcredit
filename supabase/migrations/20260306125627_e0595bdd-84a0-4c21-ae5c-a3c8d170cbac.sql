-- Add column for consultant name
ALTER TABLE public.consulta_history ADD COLUMN consulted_by_name text;

-- Remove restrictive SELECT policies
DROP POLICY IF EXISTS "Users can view own consulta history" ON public.consulta_history;
DROP POLICY IF EXISTS "Admins can view all consulta history" ON public.consulta_history;

-- New policy: all authenticated users can view all history
CREATE POLICY "All authenticated can view consulta history"
  ON public.consulta_history FOR SELECT TO authenticated
  USING (true);