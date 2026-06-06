-- Add registration number and section to student profiles
ALTER TABLE public.student_profiles
ADD COLUMN IF NOT EXISTS reg_number TEXT,
ADD COLUMN IF NOT EXISTS section TEXT;

CREATE INDEX IF NOT EXISTS idx_student_profiles_reg_number ON public.student_profiles(reg_number);
