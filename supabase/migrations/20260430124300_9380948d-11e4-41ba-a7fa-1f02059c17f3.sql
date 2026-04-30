-- Allow creator or admin to delete credit analysis sessions
CREATE POLICY "Creator or admin can delete sessions"
ON public.credit_analysis_sessions
FOR DELETE
TO authenticated
USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow deleting related messages
CREATE POLICY "Creator or admin can delete messages"
ON public.credit_analysis_messages
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.credit_analysis_sessions s
  WHERE s.id = credit_analysis_messages.session_id
    AND (s.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));