-- ─────────────────────────────────────────────────────────────
-- SQL Migration: session_transcripts table
-- Purpose: Stores a snapshot of the full conversation at the
--          moment a crisis is detected, tagged severity='critical'.
--          Counsellor dashboard queries this for immediate triage.
-- Run once in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS session_transcripts (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id       UUID,                          -- references sessions(id) if available
    crisis_alert_id  UUID,                          -- references crisis_alerts(id)
    severity         TEXT NOT NULL DEFAULT 'normal' -- 'normal' | 'elevated' | 'critical'
                     CHECK (severity IN ('normal', 'elevated', 'critical')),
    messages         JSONB NOT NULL DEFAULT '[]',   -- full conversation snapshot
    message_count    INTEGER GENERATED ALWAYS AS (jsonb_array_length(messages)) STORED,
    flagged_message  TEXT,                          -- the specific crisis message
    keywords_matched TEXT[],
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE session_transcripts ENABLE ROW LEVEL SECURITY;

-- Students: no access (written server-side via service_role only)

-- Counsellors & Admins: can view critical transcripts
CREATE POLICY "Staff can view session transcripts"
    ON session_transcripts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_type IN ('counsellor', 'admin')
        )
    );

-- Service role (backend) full access
CREATE POLICY "Service role full access on transcripts"
    ON session_transcripts FOR ALL
    USING (auth.role() = 'service_role');

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transcripts_student_id    ON session_transcripts(student_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_severity      ON session_transcripts(severity);
CREATE INDEX IF NOT EXISTS idx_transcripts_crisis_alert  ON session_transcripts(crisis_alert_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_created_at    ON session_transcripts(created_at DESC);

-- Partial index for fast counsellor dashboard query (critical only)
CREATE INDEX IF NOT EXISTS idx_transcripts_critical
    ON session_transcripts(created_at DESC)
    WHERE severity = 'critical';
