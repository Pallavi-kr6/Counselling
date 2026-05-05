-- =====================================================
-- SCHEMA MIGRATION: Counsellor Cancel & Auto-Reassignment
-- =====================================================

-- This project stores scheduled counselling sessions in the appointments table.
-- The migration below upgrades appointments to support the reassignment workflow.

-- 1. Normalize existing status values so the new constraint can be applied safely.
UPDATE appointments
SET status = CASE
  WHEN status IN ('confirmed', 'rescheduled') THEN 'scheduled'
  WHEN status IN ('cancelled_by_counsellor', 'needs_reschedule', 'pending_counsellor_acceptance', 'pending_student_confirmation') THEN 'cancelled'
  ELSE status
END
WHERE status IN (
  'confirmed',
  'rescheduled',
  'cancelled_by_counsellor',
  'needs_reschedule',
  'pending_counsellor_acceptance',
  'pending_student_confirmation'
);

-- 2. Extend appointments for reassignment state.
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reassigned_counsellor_id UUID REFERENCES counsellor_profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counsellor_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS student_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reassignment_attempted_counsellor_ids UUID[] DEFAULT '{}';

ALTER TABLE appointments
  ALTER COLUMN status SET DEFAULT 'scheduled';

ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled', 'pending_reassign', 'reassigned', 'cancelled', 'completed'));

-- 3. Create notifications table for reassignment prompts.
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'reassignment_request',
    'student_reassignment_approval',
    'student_confirmation_pending',
    'session_reassigned',
    'session_cancelled',
    'session_update',
    'student_rejected'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  action_required BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create audit log for reassignment actions.
CREATE TABLE IF NOT EXISTS session_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type TEXT,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Helpful indexes.
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_reassigned_counsellor ON appointments(reassigned_counsellor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_reassignment_attempts ON appointments USING GIN(reassignment_attempted_counsellor_ids);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_action_required ON notifications(recipient_id, action_required, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_session ON notifications(session_id);
CREATE INDEX IF NOT EXISTS idx_session_audit_log_session ON session_audit_log(session_id, created_at);

-- 6. Helper function used by the backend flow.
CREATE OR REPLACE FUNCTION find_available_counsellor(
  p_session_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_day_order_id UUID,
  p_excluded_ids UUID[]
)
RETURNS TABLE(counsellor_id UUID, counsellor_name TEXT, department TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.user_id,
    cp.name,
    cp.department
  FROM counsellor_profiles cp
  WHERE cp.user_id <> ALL(COALESCE(p_excluded_ids, ARRAY[]::UUID[]))
    AND EXISTS (
      SELECT 1
      FROM counsellor_availability ca
      WHERE ca.day_order_id = p_day_order_id
        AND ca.is_available = TRUE
        AND ca.counsellor_id IN (cp.id, cp.user_id)
        AND ca.start_time <= p_start_time
        AND ca.end_time >= p_end_time
    )
    AND NOT EXISTS (
      SELECT 1
      FROM appointments a
      WHERE a.counsellor_id = cp.user_id
        AND a.date = p_session_date
        AND a.status IN ('scheduled', 'pending_reassign', 'reassigned')
        AND (p_start_time, p_end_time) OVERLAPS (a.start_time, a.end_time)
    )
  ORDER BY cp.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
