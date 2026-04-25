-- ─────────────────────────────────────────────────────────────
-- SQL Migration: crisis_alerts table
-- Purpose: Store server-detected crisis events with a resolved
--          available counsellor and a 280-char message snippet.
-- Run this in your Supabase SQL Editor (one-time).
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create crisis_alerts table
CREATE TABLE IF NOT EXISTS crisis_alerts (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_email     TEXT,
    message_snippet   TEXT NOT NULL,          -- first 280 chars of the flagged message
    keywords_matched  TEXT[],                 -- e.g. ['suicide', 'kill myself']
    assigned_counsellor_id   UUID,            -- counsellor_profiles.id of next available counsellor
    assigned_counsellor_name TEXT,
    notification_sent BOOLEAN DEFAULT FALSE,  -- true once email/SMS fired
    resolved          BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at       TIMESTAMP WITH TIME ZONE
);

-- 2. Row Level Security
ALTER TABLE crisis_alerts ENABLE ROW LEVEL SECURITY;

-- Students: no direct access (server-side only via service_role)
-- Counsellors & Admins can view / update
CREATE POLICY "Staff can view crisis alerts"
    ON crisis_alerts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_type IN ('counsellor', 'admin')
        )
    );

CREATE POLICY "Staff can update crisis alerts"
    ON crisis_alerts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_type IN ('counsellor', 'admin')
        )
    );

-- Service role (backend) can do everything
CREATE POLICY "Service role full access"
    ON crisis_alerts FOR ALL
    USING (auth.role() = 'service_role');

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_student_id  ON crisis_alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_created_at  ON crisis_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_resolved    ON crisis_alerts(resolved) WHERE resolved = FALSE;

-- ─────────────────────────────────────────────────────────────
-- KEEP the old crisis_flags table intact (backwards compat).
-- The new crisis_alerts table is the authoritative record.
-- ─────────────────────────────────────────────────────────────
