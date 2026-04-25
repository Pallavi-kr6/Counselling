-- ─────────────────────────────────────────────────────────────
-- SQL Migration: Add mood_score to mood_logs
-- Purpose: Records the 1-5 pre-chat emoji selection explicitly.
-- Run once in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS mood_score INTEGER;
