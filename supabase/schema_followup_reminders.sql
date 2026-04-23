-- =====================================================
-- SCHEMA MIGRATION: 7-Day Follow-Up Reminders
-- =====================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS followup_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS student_followup_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS counsellor_followup_sent_at TIMESTAMP WITH TIME ZONE;

-- Backfill already-completed sessions so the reminder job can pick them up.
UPDATE appointments
SET
  completed_at = COALESCE(completed_at, updated_at, created_at),
  followup_at = COALESCE(followup_at, (COALESCE(completed_at, updated_at, created_at) + INTERVAL '7 days'))
WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_appointments_followup_due
ON appointments (status, followup_at);

CREATE INDEX IF NOT EXISTS idx_appointments_followup_student_pending
ON appointments (student_followup_sent_at)
WHERE student_followup_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_followup_counsellor_pending
ON appointments (counsellor_followup_sent_at)
WHERE counsellor_followup_sent_at IS NULL;
