-- ─────────────────────────────────────────────────────────────
-- SQL Migration: Add timestamp availability logic to Counsellors
-- ─────────────────────────────────────────────────────────────

ALTER TABLE counsellor_profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT false;
ALTER TABLE counsellor_profiles ADD COLUMN IF NOT EXISTS available_until TIMESTAMP WITH TIME ZONE;
