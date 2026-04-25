-- ─────────────────────────────────────────────────────────────
-- SQL Migration: Add session_notes for private counsellor logs
-- ─────────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS risk_level_enum AS ENUM ('low', 'medium', 'high');

CREATE TABLE IF NOT EXISTS session_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    counsellor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notes_text TEXT NOT NULL,
    risk_level risk_level_enum DEFAULT 'low',
    next_action TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Only Counsellors and Admins can view/edit
CREATE POLICY "Strict Admin/Counsellor Access" 
ON session_notes 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.user_type IN ('admin', 'counsellor')
    )
);
