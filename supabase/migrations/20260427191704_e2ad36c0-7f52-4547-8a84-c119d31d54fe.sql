-- Enum para o tipo de entidade
CREATE TYPE public.entity_note_type AS ENUM ('cliente', 'cedente', 'sacado');

-- Tabela de notas
CREATE TABLE public.entity_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type public.entity_note_type NOT NULL,
  entity_cpf_cnpj TEXT NOT NULL,
  entity_name TEXT,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_notes_lookup ON public.entity_notes (entity_type, entity_cpf_cnpj, created_at DESC);

ALTER TABLE public.entity_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view notes"
ON public.entity_notes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert notes"
ON public.entity_notes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Author or admin can update notes"
ON public.entity_notes FOR UPDATE
TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Author or admin can delete notes"
ON public.entity_notes FOR DELETE
TO authenticated
USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_entity_notes_updated_at
BEFORE UPDATE ON public.entity_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();