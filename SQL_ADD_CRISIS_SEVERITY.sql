-- ─────────────────────────────────────────────────────────────
-- SQL Migration: Add severity flag to crisis_alerts
-- Purpose: Marks crisis alerts with a severity category ("HIGH").
-- Run once in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE crisis_alerts
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'HIGH';

-- Ensure the existing alerts get marked logically if desired
UPDATE crisis_alerts SET severity = 'HIGH' WHERE severity IS NULL;
