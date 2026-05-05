-- Complete Supabase schema for the Counselling project.
-- Run this in the Supabase SQL Editor for a fresh project.
-- This file intentionally keeps public.users independent from auth.users:
-- students are synced with auth.users by the backend, while counsellors use
-- teacher_id login and can be seeded directly in public.users.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_level_enum') THEN
    CREATE TYPE risk_level_enum AS ENUM ('low', 'medium', 'high');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  user_type TEXT NOT NULL DEFAULT 'student'
    CHECK (user_type IN ('student', 'counsellor', 'admin')),
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  nickname TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT,
  year TEXT,
  course TEXT,
  gender TEXT,
  contact_info TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.counsellor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT,
  designation TEXT,
  teacher_id TEXT UNIQUE,
  gmail TEXT,
  room_no TEXT,
  phone_no TEXT,
  department TEXT,
  is_available BOOLEAN NOT NULL DEFAULT FALSE,
  available_until TIMESTAMPTZ,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.day_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_name TEXT NOT NULL UNIQUE,
  order_number INTEGER NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.counsellor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Existing code supports either counsellor_profiles.id or counsellor_profiles.user_id.
  -- The seeded data below uses counsellor_profiles.id, while older helper SQL may use user_id.
  counsellor_id UUID NOT NULL,
  day_order_id UUID REFERENCES public.day_orders(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT counsellor_availability_time_check CHECK (end_time > start_time),
  CONSTRAINT counsellor_availability_unique
    UNIQUE (counsellor_id, day_order_id, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  counsellor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  day_order_id UUID REFERENCES public.day_orders(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  start_datetime TIMESTAMPTZ,
  end_datetime TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN (
      'pending',
      'scheduled',
      'confirmed',
      'pending_reassign',
      'reassigned',
      'cancelled',
      'completed',
      'no_show'
    )),
  completed_at TIMESTAMPTZ,
  followup_at TIMESTAMPTZ,
  student_followup_sent_at TIMESTAMPTZ,
  counsellor_followup_sent_at TIMESTAMPTZ,
  notes TEXT,
  reassigned_counsellor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  counsellor_approved BOOLEAN NOT NULL DEFAULT FALSE,
  student_approved BOOLEAN NOT NULL DEFAULT FALSE,
  reassignment_attempted_counsellor_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT appointments_time_check CHECK (end_time > start_time),
  CONSTRAINT check_appointment_datetimes CHECK (
    start_datetime IS NULL OR end_datetime IS NULL OR end_datetime > start_datetime
  )
);

CREATE OR REPLACE FUNCTION public.sync_appointment_datetime_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.date IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.start_datetime = (NEW.date + NEW.start_time) AT TIME ZONE 'Asia/Kolkata';
  ELSIF NEW.start_datetime IS NOT NULL THEN
    NEW.date = (NEW.start_datetime AT TIME ZONE 'Asia/Kolkata')::DATE;
    NEW.start_time = (NEW.start_datetime AT TIME ZONE 'Asia/Kolkata')::TIME;
  END IF;

  IF NEW.date IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    NEW.end_datetime = (NEW.date + NEW.end_time) AT TIME ZONE 'Asia/Kolkata';
  ELSIF NEW.end_datetime IS NOT NULL THEN
    NEW.end_time = (NEW.end_datetime AT TIME ZONE 'Asia/Kolkata')::TIME;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_datetime_fields ON public.appointments;
CREATE TRIGGER trg_sync_appointment_datetime_fields
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_datetime_fields();

CREATE TABLE IF NOT EXISTS public.mood_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood INTEGER CHECK (mood BETWEEN 1 AND 10),
  emoji TEXT,
  notes TEXT,
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  sleep_hours NUMERIC(4,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.mood_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  session_id UUID,
  mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 10),
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crisis_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crisis_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  student_email TEXT,
  message_snippet TEXT,
  keywords_matched TEXT[],
  assigned_counsellor_id UUID,
  assigned_counsellor_name TEXT,
  severity TEXT NOT NULL DEFAULT 'HIGH',
  notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.session_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID,
  crisis_alert_id UUID REFERENCES public.crisis_alerts(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'normal'
    CHECK (severity IN ('normal', 'elevated', 'critical')),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(messages)) STORED,
  flagged_message TEXT,
  keywords_matched TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.soft_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  flagged_message TEXT NOT NULL,
  reason TEXT NOT NULL,
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_watch_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL DEFAULT 'watch' CHECK (tag IN ('watch', 'urgent', 'resolved')),
  reason TEXT NOT NULL,
  avg_mood_score NUMERIC(4,2),
  consecutive_days INTEGER,
  threshold_used NUMERIC(4,2),
  mood_window_start DATE,
  mood_window_end DATE,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_watch_flags_student_profile_fkey'
  ) THEN
    ALTER TABLE public.student_watch_flags
      ADD CONSTRAINT student_watch_flags_student_profile_fkey
      FOREIGN KEY (student_id) REFERENCES public.student_profiles(user_id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('article', 'video', 'podcast', 'toolkit', 'exercise', 'pdf')),
  category TEXT,
  url TEXT,
  content_url TEXT,
  content TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resource_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.session_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  counsellor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (appointment_id)
);

CREATE TABLE IF NOT EXISTS public.progress_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  counsellor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  student_name TEXT,
  register_number TEXT,
  department_year TEXT,
  counsellor_name TEXT,
  academic_performance JSONB,
  previous_goals_review JSONB,
  issues_challenges TEXT[],
  other_issues TEXT,
  counseling_support JSONB,
  next_week_plan JSONB,
  counsellor_remarks TEXT,
  student_commitment BOOLEAN NOT NULL DEFAULT FALSE,
  student_signature TEXT,
  student_signature_date DATE,
  counsellor_signature TEXT,
  counsellor_signature_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('PHQ-9')),
  responses INTEGER[] NOT NULL,
  total_score INTEGER NOT NULL CHECK (total_score BETWEEN 0 AND 27),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT questionnaire_responses_phq9_length
    CHECK (type <> 'PHQ-9' OR array_length(responses, 1) = 9)
);

CREATE TABLE IF NOT EXISTS public.zoom_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  meeting_number TEXT NOT NULL,
  meeting_password TEXT,
  start_url TEXT,
  join_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  type TEXT CHECK (type IN ('campus', 'national', 'faculty')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.college_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fallback_admin_email TEXT,
  emergency_duty_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
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
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  action_required BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.session_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_type TEXT,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  counsellor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  notes_text TEXT NOT NULL,
  risk_level risk_level_enum NOT NULL DEFAULT 'low',
  next_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_version VARCHAR(10) NOT NULL DEFAULT 'v1.0'
);

CREATE OR REPLACE FUNCTION public.anonymise_student_data(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.student_profiles
  SET name = 'Anonymised User',
      contact_info = NULL,
      gender = NULL,
      course = NULL,
      year = NULL,
      updated_at = NOW()
  WHERE user_id = target_user_id;

  DELETE FROM public.student_consents WHERE student_id = target_user_id;
  DELETE FROM public.chat_sessions WHERE student_id = target_user_id;
  DELETE FROM public.sessions WHERE user_id = target_user_id;
  DELETE FROM public.crisis_alerts WHERE student_id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_department_mood_heatmap(months_back INTEGER DEFAULT 6)
RETURNS TABLE(
  department TEXT,
  month_key TEXT,
  avg_mood NUMERIC,
  alert_count BIGINT,
  entry_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH mood_agg AS (
    SELECT
      sp.department,
      TO_CHAR(DATE_TRUNC('month', ml.created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_key,
      ROUND(AVG(ml.mood_score)::NUMERIC, 2) AS avg_mood,
      COUNT(ml.id) AS entry_count
    FROM public.mood_logs ml
    JOIN public.student_profiles sp ON sp.user_id = ml.user_id
    WHERE sp.department IS NOT NULL
      AND TRIM(sp.department) <> ''
      AND ml.created_at >= DATE_TRUNC('month', NOW() - ((months_back || ' months')::INTERVAL))
    GROUP BY sp.department, DATE_TRUNC('month', ml.created_at AT TIME ZONE 'UTC')
  ),
  crisis_agg AS (
    SELECT
      sp.department,
      TO_CHAR(DATE_TRUNC('month', ca.created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_key,
      COUNT(ca.id) AS alert_count
    FROM public.crisis_alerts ca
    JOIN public.student_profiles sp ON sp.user_id = ca.student_id
    WHERE sp.department IS NOT NULL
      AND TRIM(sp.department) <> ''
      AND ca.created_at >= DATE_TRUNC('month', NOW() - ((months_back || ' months')::INTERVAL))
    GROUP BY sp.department, DATE_TRUNC('month', ca.created_at AT TIME ZONE 'UTC')
  )
  SELECT
    COALESCE(m.department, c.department),
    COALESCE(m.month_key, c.month_key),
    m.avg_mood,
    COALESCE(c.alert_count, 0),
    COALESCE(m.entry_count, 0)
  FROM mood_agg m
  FULL OUTER JOIN crisis_agg c
    ON m.department = c.department
   AND m.month_key = c.month_key
  ORDER BY 1 ASC, 2 ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_department_mood_heatmap(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_department_mood_heatmap(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.anonymise_student_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anonymise_student_data(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.find_available_counsellor(
  p_session_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_day_order_id UUID,
  p_excluded_ids UUID[]
)
RETURNS TABLE(counsellor_id UUID, counsellor_name TEXT, department TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT cp.user_id, cp.name, cp.department
  FROM public.counsellor_profiles cp
  WHERE cp.user_id <> ALL(COALESCE(p_excluded_ids, ARRAY[]::UUID[]))
    AND EXISTS (
      SELECT 1
      FROM public.counsellor_availability ca
      WHERE ca.day_order_id = p_day_order_id
        AND ca.is_available = TRUE
        AND ca.counsellor_id IN (cp.id, cp.user_id)
        AND ca.start_time <= p_start_time
        AND ca.end_time >= p_end_time
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.counsellor_id = cp.user_id
        AND a.date = p_session_date
        AND a.status IN ('scheduled', 'confirmed', 'pending_reassign', 'reassigned')
        AND (p_start_time, p_end_time) OVERLAPS (a.start_time, a.end_time)
    )
  ORDER BY cp.created_at ASC
  LIMIT 1;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users',
    'student_profiles',
    'counsellor_profiles',
    'day_orders',
    'counsellor_availability',
    'appointments',
    'mood_tracking',
    'sessions',
    'chat_sessions',
    'resources',
    'progress_reports',
    'college_config',
    'notifications',
    'student_watch_flags'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_update_updated_at ON public.%I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_update_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      tbl
    );
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_no_double_booking
ON public.appointments (counsellor_id, date, start_time, end_time)
WHERE status IN ('scheduled', 'confirmed', 'pending_reassign', 'reassigned', 'completed');

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users(user_type);
CREATE INDEX IF NOT EXISTS idx_student_profiles_department ON public.student_profiles(department);
CREATE INDEX IF NOT EXISTS idx_counsellor_profiles_teacher_id ON public.counsellor_profiles(teacher_id);
CREATE INDEX IF NOT EXISTS idx_counsellor_profiles_department ON public.counsellor_profiles(department);
CREATE INDEX IF NOT EXISTS idx_counsellor_profiles_is_available ON public.counsellor_profiles(is_available) WHERE is_available = TRUE;
CREATE INDEX IF NOT EXISTS idx_counsellor_profiles_is_online ON public.counsellor_profiles(is_online) WHERE is_online = TRUE;
CREATE INDEX IF NOT EXISTS idx_day_orders_active ON public.day_orders(is_active);
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_day_order ON public.counsellor_availability(day_order_id);
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_counsellor ON public.counsellor_availability(counsellor_id);
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_active ON public.counsellor_availability(day_order_id, is_available) WHERE is_available = TRUE;
CREATE INDEX IF NOT EXISTS idx_appointments_student ON public.appointments(student_id);
CREATE INDEX IF NOT EXISTS idx_appointments_counsellor ON public.appointments(counsellor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_start_datetime ON public.appointments(start_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_followup_due ON public.appointments(status, followup_at);
CREATE INDEX IF NOT EXISTS idx_appointments_reassigned_counsellor ON public.appointments(reassigned_counsellor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_reassignment_attempts ON public.appointments USING GIN(reassignment_attempted_counsellor_ids);
CREATE INDEX IF NOT EXISTS idx_mood_tracking_user_date ON public.mood_tracking(user_id, date);
CREATE INDEX IF NOT EXISTS idx_mood_logs_user_created ON public.mood_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mood_logs_session ON public.mood_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_updated ON public.sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_student_id ON public.crisis_alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_created_at ON public.crisis_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crisis_alerts_unresolved ON public.crisis_alerts(created_at DESC) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_transcripts_student_id ON public.session_transcripts(student_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_crisis_alert ON public.session_transcripts(crisis_alert_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_critical ON public.session_transcripts(created_at DESC) WHERE severity = 'critical';
CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_flags_active_student ON public.student_watch_flags(student_id) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_watch_flags_created_at ON public.student_watch_flags(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_type ON public.resources(type);
CREATE INDEX IF NOT EXISTS idx_resources_is_active ON public.resources(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_resource_views_user ON public.resource_views(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_counsellor ON public.session_feedback(counsellor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_reports_student ON public.progress_reports(student_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_user ON public.questionnaire_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_appointment ON public.questionnaire_responses(appointment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_action_required ON public.notifications(recipient_id, action_required, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_session ON public.notifications(session_id);
CREATE INDEX IF NOT EXISTS idx_session_audit_log_session ON public.session_audit_log(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_session_notes_session ON public.session_notes(session_id);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counsellor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counsellor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crisis_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crisis_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soft_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_watch_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_consents ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users','student_profiles','counsellor_profiles','day_orders',
    'counsellor_availability','appointments','mood_tracking','mood_logs',
    'sessions','chat_sessions','crisis_flags','crisis_alerts',
    'session_transcripts','soft_alerts','student_watch_flags','resources',
    'resource_views','session_feedback','progress_reports',
    'questionnaire_responses','zoom_meetings','emergency_contacts',
    'college_config','notifications','session_audit_log','session_notes',
    'student_consents'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY "service_role_full_access" ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      tbl
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "public_read_counsellors" ON public.counsellor_profiles;
CREATE POLICY "public_read_counsellors"
ON public.counsellor_profiles FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "public_read_day_orders" ON public.day_orders;
CREATE POLICY "public_read_day_orders"
ON public.day_orders FOR SELECT
USING (is_active = TRUE);

DROP POLICY IF EXISTS "public_read_availability" ON public.counsellor_availability;
CREATE POLICY "public_read_availability"
ON public.counsellor_availability FOR SELECT
USING (is_available = TRUE);

DROP POLICY IF EXISTS "public_read_resources" ON public.resources;
CREATE POLICY "public_read_resources"
ON public.resources FOR SELECT
USING (is_active = TRUE);

DROP POLICY IF EXISTS "public_read_emergency_contacts" ON public.emergency_contacts;
CREATE POLICY "public_read_emergency_contacts"
ON public.emergency_contacts FOR SELECT
USING (is_active = TRUE);

DROP POLICY IF EXISTS "students_own_consent_select" ON public.student_consents;
CREATE POLICY "students_own_consent_select"
ON public.student_consents FOR SELECT
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "students_own_consent_insert" ON public.student_consents;
CREATE POLICY "students_own_consent_insert"
ON public.student_consents FOR INSERT
WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "students_own_consent_delete" ON public.student_consents;
CREATE POLICY "students_own_consent_delete"
ON public.student_consents FOR DELETE
USING (auth.uid() = student_id);

INSERT INTO public.day_orders (order_name, order_number, description, is_active)
VALUES
  ('Day Order 1', 1, 'First rotation day', TRUE),
  ('Day Order 2', 2, 'Second rotation day', TRUE),
  ('Day Order 3', 3, 'Third rotation day', TRUE),
  ('Day Order 4', 4, 'Fourth rotation day', TRUE),
  ('Day Order 5', 5, 'Fifth rotation day', TRUE)
ON CONFLICT (order_number) DO UPDATE
SET order_name = EXCLUDED.order_name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO public.emergency_contacts (name, phone, type, description, is_active)
VALUES
  ('KIRAN Helpline', '9152987821', 'national', 'National Mental Health Helpline - 24/7', TRUE),
  ('Campus Helpline', 'YOUR_CAMPUS_PHONE', 'campus', 'College campus emergency helpline', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO public.college_config (fallback_admin_email, emergency_duty_number)
SELECT 'admin@college.edu', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.college_config);

INSERT INTO public.resources (title, description, category, url, content_url, type, is_active)
VALUES
  ('Managing Academic Stress', 'Practical steps to handle academic pressure.', 'stress', 'https://students.dartmouth.edu/wellness-center/wellness-mindfulness/relaxation-downloads/managing-academic-stress', 'https://students.dartmouth.edu/wellness-center/wellness-mindfulness/relaxation-downloads/managing-academic-stress', 'article', TRUE),
  ('Box Breathing Exercise', 'A structured 4-4-4-4 breathing exercise.', 'stress', 'https://www.healthline.com/health/box-breathing', 'https://www.healthline.com/health/box-breathing', 'exercise', TRUE),
  ('5-4-3-2-1 Grounding Technique', 'A grounding method for anxiety and spiralling thoughts.', 'anxiety', 'https://www.urmc.rochester.edu/behavioral-health-partners/bhp-blog/april-2018/5-4-3-2-1-coping-technique-for-anxiety.aspx', 'https://www.urmc.rochester.edu/behavioral-health-partners/bhp-blog/april-2018/5-4-3-2-1-coping-technique-for-anxiety.aspx', 'article', TRUE),
  ('Progressive Muscle Relaxation', 'Release anxiety stored in the body.', 'anxiety', 'https://www.anxietycanada.com/articles/how-to-do-progressive-muscle-relaxation/', 'https://www.anxietycanada.com/articles/how-to-do-progressive-muscle-relaxation/', 'exercise', TRUE),
  ('Setting Healthy Boundaries', 'Learn how to express needs and build safer relationships.', 'relationships', 'https://www.betterhelp.com/advice/relations/setting-healthy-boundaries/', 'https://www.betterhelp.com/advice/relations/setting-healthy-boundaries/', 'article', TRUE),
  ('Evidence-Based Study Techniques', 'Retrieval practice and spaced repetition for learning.', 'academic', 'https://learningscientists.org/six-strategies-for-effective-learning', 'https://learningscientists.org/six-strategies-for-effective-learning', 'article', TRUE)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  c RECORD;
  v_user_id UUID;
  v_profile_id UUID;
  v_day_order_id UUID;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('gayathri@college.edu', 'Dr. V.M Gayathri', 'Associate Professor', 'GAY001', 'Networking & Comm (NWC)', 'NWC-101', '9876543211'),
      ('helen@college.edu', 'Dr. A.Helen Victoria', 'Associate Professor', 'HEL001', 'Networking & Comm (NWC)', 'NWC-102', '9876543212'),
      ('supraja@college.edu', 'Dr. P.Supraja', 'Associate Professor', 'SUP001', 'Value Education Cell', 'VEC-101', '9876543213'),
      ('arun@college.edu', 'Dr. A Arun', 'Associate Professor', 'ARU001', 'Networking & Comm (NWC)', 'NWC-103', '9876543214'),
      ('vaishnavi@college.edu', 'Dr. M.Vaishnavi Moorthy', 'Associate Professor', 'VAI001', 'Networking & Comm (NWC)', 'NWC-104', '9876543215'),
      ('lakshmi@college.edu', 'Dr. Lakshmi Narayanan K', 'Associate Professor', 'LAK001', 'Networking & Comm (NWC)', 'NWC-105', '9876543216')
    ) AS x(email, name, designation, teacher_id, department, room_no, phone_no)
  LOOP
    INSERT INTO public.users (email, user_type, is_anonymous)
    VALUES (c.email, 'counsellor', FALSE)
    ON CONFLICT (email) DO UPDATE
    SET user_type = 'counsellor',
        updated_at = NOW()
    RETURNING id INTO v_user_id;

    INSERT INTO public.counsellor_profiles (
      user_id, name, designation, teacher_id, gmail, room_no, phone_no,
      department, is_available, is_online
    )
    VALUES (
      v_user_id, c.name, c.designation, c.teacher_id, c.email, c.room_no,
      c.phone_no, c.department, TRUE, TRUE
    )
    ON CONFLICT (user_id) DO UPDATE
    SET name = EXCLUDED.name,
        designation = EXCLUDED.designation,
        teacher_id = EXCLUDED.teacher_id,
        gmail = EXCLUDED.gmail,
        room_no = EXCLUDED.room_no,
        phone_no = EXCLUDED.phone_no,
        department = EXCLUDED.department,
        is_available = TRUE,
        is_online = TRUE,
        updated_at = NOW()
    RETURNING id INTO v_profile_id;

    FOR v_day_order_id IN SELECT id FROM public.day_orders WHERE is_active = TRUE LOOP
      INSERT INTO public.counsellor_availability (
        counsellor_id, day_order_id, start_time, end_time, is_available
      )
      VALUES
        (v_profile_id, v_day_order_id, '09:00', '11:00', TRUE),
        (v_profile_id, v_day_order_id, '13:00', '15:00', TRUE)
      ON CONFLICT (counsellor_id, day_order_id, start_time, end_time) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('resources', 'resources', TRUE)
  ON CONFLICT (id) DO UPDATE SET public = TRUE;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'storage.buckets is unavailable in this context; create a public bucket named resources from Supabase Storage UI.';
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "public_read_resources_storage" ON storage.objects;
  CREATE POLICY "public_read_resources_storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resources');

  DROP POLICY IF EXISTS "public_insert_resources_storage" ON storage.objects;
  CREATE POLICY "public_insert_resources_storage"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resources');

  DROP POLICY IF EXISTS "public_delete_resources_storage" ON storage.objects;
  CREATE POLICY "public_delete_resources_storage"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'resources');
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'storage.objects is unavailable in this context; add storage policies from Supabase Storage UI.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crisis_alerts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
