
CREATE POLICY "Creator or admin can delete clients"
  ON public.consulta_clients FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));
