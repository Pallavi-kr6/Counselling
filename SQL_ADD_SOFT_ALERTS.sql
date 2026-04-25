-- ─────────────────────────────────────────────────────────────
-- SQL Migration: soft_alerts table
-- Purpose: Records non-critical rule violations like repeated 
--          profanity to be reviewed by a counsellor later.
-- Run once in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS soft_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    flagged_message TEXT NOT NULL,
    reason TEXT NOT NULL,
    reviewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic RLS
ALTER TABLE soft_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Counsellors can view soft alerts"
    ON soft_alerts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_type IN ('counsellor', 'admin')
        )
    );

CREATE POLICY "Service role full access on soft alerts"
    ON soft_alerts FOR ALL
    USING (auth.role() = 'service_role');
