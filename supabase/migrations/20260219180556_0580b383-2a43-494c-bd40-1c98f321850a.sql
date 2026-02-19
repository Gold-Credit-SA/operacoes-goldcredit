CREATE TABLE public.cedente_birthdays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cedente_cpf_cnpj text NOT NULL UNIQUE,
  cedente_nome text NOT NULL,
  data_nascimento date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cedente_birthdays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read birthdays"
  ON public.cedente_birthdays FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert birthdays"
  ON public.cedente_birthdays FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update birthdays"
  ON public.cedente_birthdays FOR UPDATE
  TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete birthdays"
  ON public.cedente_birthdays FOR DELETE
  TO authenticated USING (auth.uid() = created_by);