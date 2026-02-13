
-- Add must_change_password flag to profiles
ALTER TABLE public.profiles 
ADD COLUMN must_change_password boolean NOT NULL DEFAULT true;

-- Existing users (like the master admin) should NOT be forced to change
UPDATE public.profiles SET must_change_password = false;
