-- Permite que o dono da consulta (ou um admin) atualize o conteúdo de um registro de consulta_history.
-- Usado pelo botão "Reabrir SCR/Serasa" quando detecta erro técnico no resultado salvo e refaz a consulta,
-- substituindo o payload zerado em vez de criar um novo registro de histórico.
CREATE POLICY "Owner or admin can update consulta history"
ON public.consulta_history
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));