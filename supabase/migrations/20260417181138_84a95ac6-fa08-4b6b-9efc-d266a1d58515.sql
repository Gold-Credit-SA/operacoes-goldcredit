ALTER TABLE public.credit_analysis_sessions
ADD COLUMN IF NOT EXISTS sacados jsonb DEFAULT '[]'::jsonb;