-- Ensure reassignment workflow notification types are accepted by existing DBs.
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_notification_type_check
CHECK (notification_type IN (
  'reassignment_request',
  'student_reassignment_approval',
  'student_confirmation_pending',
  'session_reassigned',
  'session_cancelled',
  'session_update',
  'student_rejected'
));
