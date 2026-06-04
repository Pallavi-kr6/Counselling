-- SQL Migration: Add assigned_counsellor_id to student_profiles
-- Run this in the Supabase SQL Editor.

-- Add assigned_counsellor_id column to student_profiles
ALTER TABLE public.student_profiles 
ADD COLUMN IF NOT EXISTS assigned_counsellor_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Create index to optimize queries
CREATE INDEX IF NOT EXISTS idx_student_profiles_assigned_counsellor 
ON public.student_profiles(assigned_counsellor_id);
