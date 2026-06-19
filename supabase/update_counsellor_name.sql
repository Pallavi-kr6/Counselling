-- SQL Command to update the counsellor name in counsellor_profiles
-- Run this in the Supabase SQL Editor

UPDATE public.counsellor_profiles
SET name = 'Dr. R. Lakshminarayanan'
WHERE name = 'Dr. Lakshmi Narayanan K' OR gmail = 'lakshmi@college.edu';

-- Verification query
SELECT name, gmail, designation, department 
FROM public.counsellor_profiles 
WHERE gmail = 'lakshmi@college.edu';
