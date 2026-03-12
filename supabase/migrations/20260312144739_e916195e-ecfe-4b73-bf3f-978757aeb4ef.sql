
CREATE TABLE public.consulta_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf_cnpj TEXT NOT NULL UNIQUE,
  name TEXT,
  agrisk_client_id TEXT,
  basic_data JSONB,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.consulta_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all clients"
  ON public.consulta_clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clients"
  ON public.consulta_clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or admin can update clients"
  ON public.consulta_clients FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_consulta_clients_updated_at
  BEFORE UPDATE ON public.consulta_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
