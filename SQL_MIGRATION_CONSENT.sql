-- ─────────────────────────────────────────────────────────────
-- SQL Migration: Student Consents
-- Creates the student_consents table to track explicit consent
-- for data storage and AI analysis.
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS student_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consented_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    consent_version VARCHAR(10) NOT NULL DEFAULT 'v1.0',
    UNIQUE(student_id)
);

-- RLS policies
ALTER TABLE student_consents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Students can view own consent'
      AND tablename = 'student_consents'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Students can view own consent"
        ON student_consents FOR SELECT
        USING (auth.uid() = student_id);
    $policy$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Students can insert own consent'
      AND tablename = 'student_consents'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Students can insert own consent"
        ON student_consents FOR INSERT
        WITH CHECK (auth.uid() = student_id);
    $policy$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Students can delete own consent'
      AND tablename = 'student_consents'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Students can delete own consent"
        ON student_consents FOR DELETE
        USING (auth.uid() = student_id);
    $policy$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access on student_consents'
      AND tablename = 'student_consents'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Service role full access on student_consents"
        ON student_consents FOR ALL
        USING (auth.role() = 'service_role');
    $policy$;
  END IF;
END$$;

-- Helper RPC function to completely anonymise a user's data when they withdraw consent
-- It zeroes out their profile info, but leaves aggregate mood data / chat records without PII attached if you wish,
-- but the simplest approach to true anonymisation inside the DB is to clear their profile.
CREATE OR REPLACE FUNCTION anonymise_student_data(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Anonymise Profile (keeps department for heatmap stats, removes name/email/contact)
    UPDATE student_profiles
    SET 
        name = 'Anonymised User',
        contact_info = NULL,
        gender = NULL
    WHERE user_id = target_user_id;

    -- 2. Delete explicit consent record
    DELETE FROM student_consents WHERE student_id = target_user_id;

    -- 3. Optionally remove transcripts and explicit crisis alerts to prevent future leakage
    -- (If we truly anonymise, retaining the user_id on these might still link them back to the anonymised profile, 
    -- but usually 'withdrawing consent' means 'forget my chat history').
    DELETE FROM chat_sessions WHERE student_id = target_user_id;
    DELETE FROM crisis_alerts WHERE student_id = target_user_id;

    -- Mood logs can stay as they just link to the anonymised profile (useful for dept heatmap)
END;
$$;
