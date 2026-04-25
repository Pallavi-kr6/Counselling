-- ─────────────────────────────────────────────────────────────
-- SQL Migration: Add real-time is_online flag to counsellor_profiles
-- Purpose: Allows counsellors to toggle themselves online/offline
--          for immediate crisis routing, independent of their 
--          long-term availability schedule.
-- Run once in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

-- Add the column
ALTER TABLE counsellor_profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Create an index to quickly find online counsellors for crisis routing
CREATE INDEX IF NOT EXISTS idx_counsellor_profiles_is_online 
ON counsellor_profiles(is_online) 
WHERE is_online = true;
