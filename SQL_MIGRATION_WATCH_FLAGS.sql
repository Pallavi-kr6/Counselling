-- ─────────────────────────────────────────────────────────────
-- SQL Migration: student_watch_flags table
-- Purpose: Records students auto-flagged by the mood analysis
--          job as needing counsellor attention.
--          Tag "watch" = mood dropped below threshold ≥3 days.
-- Run once in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Watch flags table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_watch_flags (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Why flagged
    tag                 TEXT NOT NULL DEFAULT 'watch'
                        CHECK (tag IN ('watch', 'urgent', 'resolved')),
    reason              TEXT NOT NULL,              -- human-readable e.g. "Avg mood 3.4 for 4 consecutive days"

    -- Mood evidence
    avg_mood_score      NUMERIC(4,2),               -- average over the flagged window
    consecutive_days    INTEGER,                    -- how many days below threshold
    threshold_used      NUMERIC(4,2),               -- the threshold value at time of flag
    mood_window_start   DATE,                       -- first day in the declining window
    mood_window_end     DATE,                       -- last day in the declining window (usually today)

    -- Status
    acknowledged        BOOLEAN DEFAULT FALSE,      -- counsellor clicked "acknowledge"
    acknowledged_by     UUID,                       -- counsellor user_id
    acknowledged_at     TIMESTAMP WITH TIME ZONE,
    resolved            BOOLEAN DEFAULT FALSE,
    resolved_at         TIMESTAMP WITH TIME ZONE,
    notes               TEXT,                       -- counsellor notes

    -- Timestamps
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prevent duplicate active flags for the same student
-- (only one unresolved flag per student at a time)
CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_flags_active_student
    ON student_watch_flags (student_id)
    WHERE resolved = FALSE;

-- ── 2. Row Level Security ────────────────────────────────────
ALTER TABLE student_watch_flags ENABLE ROW LEVEL SECURITY;

-- Students: no access
-- Counsellors & Admins: full read + update
CREATE POLICY "Staff can view watch flags"
    ON student_watch_flags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_type IN ('counsellor', 'admin')
        )
    );

CREATE POLICY "Staff can update watch flags"
    ON student_watch_flags FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_type IN ('counsellor', 'admin')
        )
    );

-- Service role (backend cron) full access
CREATE POLICY "Service role full access on watch flags"
    ON student_watch_flags FOR ALL
    USING (auth.role() = 'service_role');

-- ── 3. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_watch_flags_student_id  ON student_watch_flags(student_id);
CREATE INDEX IF NOT EXISTS idx_watch_flags_tag         ON student_watch_flags(tag);
CREATE INDEX IF NOT EXISTS idx_watch_flags_created_at  ON student_watch_flags(created_at DESC);

-- Fast dashboard query: unresolved flags newest-first
CREATE INDEX IF NOT EXISTS idx_watch_flags_unresolved
    ON student_watch_flags(created_at DESC)
    WHERE resolved = FALSE;

-- ── 4. updated_at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_watch_flag_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_watch_flags_updated_at ON student_watch_flags;
CREATE TRIGGER trg_watch_flags_updated_at
    BEFORE UPDATE ON student_watch_flags
    FOR EACH ROW EXECUTE PROCEDURE update_watch_flag_updated_at();
