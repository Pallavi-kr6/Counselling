-- SQL_SCHEMA_MIGRATION_v3.sql
-- Migration: Refactor foreign keys, availability<>appointments relationship,
-- add appointment_status enum, prevent double-booking, add indexes, triggers and RLS
-- Safe, non-destructive, Supabase-compatible. Run inside Supabase SQL Editor.

-- IMPORTANT: Read the comments. This script PRESERVES existing data.
-- Back up your DB before running: supabase db pull > backup.sql

BEGIN;

-- 0. Preconditions: Ensure extensions and functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid() if available

-- 1. Create appointment_status enum (map 'rescheduled' -> 'scheduled' first)
-- Map legacy status valaues not in new enum to 'scheduled'
UPDATE appointments SET status = 'scheduled' WHERE status = 'rescheduled';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE appointment_status AS ENUM (
      'scheduled',
      'confirmed',
      'completed',
      'cancelled'
    );
  END IF;
END$$;

-- 2. Add updated_at to tables missing it (if not exists)
ALTER TABLE IF EXISTS counsellor_availability
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure day_orders has updated_at as well
ALTER TABLE IF EXISTS day_orders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Some tables already have updated_at; ensure not duplicated

-- 3. Create trigger function to update updated_at on UPDATE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Attach trigger to tables that should auto-update updated_at
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'users','student_profiles','counsellor_profiles','day_orders',
    'counsellor_availability','appointments','mood_tracking','resources'
  ) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_update_updated_at ON %I;', tbl);
    EXECUTE format('CREATE TRIGGER trg_update_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();', tbl);
  END LOOP;
END$$;

-- 4. Counsellor profiles: ensure id PK and user_id refers to auth.users(id)
-- Current: user_id may reference local `users(id)`. We'll switch FK to auth.users(id).
-- Drop existing FK constraint (if any) and recreate pointing to auth.users(id).
ALTER TABLE IF EXISTS counsellor_profiles DROP CONSTRAINT IF EXISTS counsellor_profiles_user_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'counsellor_profiles_user_id_fkey'
      AND table_name = 'counsellor_profiles'
  ) THEN
    EXECUTE 'ALTER TABLE counsellor_profiles ADD CONSTRAINT counsellor_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
  END IF;
END$$;

-- 5. Update counsellor_availability to reference counsellor_profiles.id safely
-- Current column `counsellor_id` stores a counsellor_profiles.user_id value.
-- We'll add a temporary column `counsellor_profile_id`, populate it by joining, then swap.
ALTER TABLE IF EXISTS counsellor_availability ADD COLUMN IF NOT EXISTS counsellor_profile_id UUID;

-- Populate counsellor_profile_id by matching counsellor_profiles.user_id = counsellor_availability.counsellor_id
UPDATE counsellor_availability ca
SET counsellor_profile_id = cp.id
FROM counsellor_profiles cp
WHERE ca.counsellor_id = cp.user_id;

-- For rows not matched (if any), create a counsellor_profile row to preserve data
INSERT INTO counsellor_profiles (id, user_id, name, created_at, updated_at)
SELECT gen_random_uuid(), ca.counsellor_id, NULL, NOW(), NOW()
FROM counsellor_availability ca
WHERE ca.counsellor_profile_id IS NULL
  AND ca.counsellor_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Re-run populate for any rows still null
UPDATE counsellor_availability ca
SET counsellor_profile_id = cp.id
FROM counsellor_profiles cp
WHERE ca.counsellor_id = cp.user_id AND ca.counsellor_profile_id IS NULL;

-- Add FK to counsellor_profile_id and drop old FK if exists
ALTER TABLE IF EXISTS counsellor_availability DROP CONSTRAINT IF EXISTS counsellor_availability_counsellor_id_fkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'counsellor_availability_counsellor_profile_id_fkey'
      AND table_name = 'counsellor_availability'
  ) THEN
    EXECUTE 'ALTER TABLE counsellor_availability ADD CONSTRAINT counsellor_availability_counsellor_profile_id_fkey FOREIGN KEY (counsellor_profile_id) REFERENCES counsellor_profiles(id) ON DELETE CASCADE';
  END IF;
END$$;

-- Ensure unique constraint on (counsellor_profile_id, day_order_id, start_time, end_time)
ALTER TABLE IF EXISTS counsellor_availability DROP CONSTRAINT IF EXISTS counsellor_availability_unique;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'counsellor_availability_unique'
      AND table_name = 'counsellor_availability'
  ) THEN
    EXECUTE 'ALTER TABLE counsellor_availability ADD CONSTRAINT counsellor_availability_unique UNIQUE (counsellor_profile_id, day_order_id, start_time, end_time)';
  END IF;
END$$;

-- Now drop old counsellor_id column (it stored user_id) only after mapping
ALTER TABLE IF EXISTS counsellor_availability DROP COLUMN IF EXISTS counsellor_id;
-- Rename counsellor_profile_id -> counsellor_id to keep column name consistent
ALTER TABLE IF EXISTS counsellor_availability RENAME COLUMN counsellor_profile_id TO counsellor_id;

-- 6. Appointments: migrate to use availability_id
-- Add availability_id column
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS availability_id UUID;

-- Add student_id referencing auth.users(id) if not already
-- Current appointments.student_id references student_profiles(user_id). We'll add new column student_user_id to preserve values, then map.
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS student_user_id UUID;

-- Populate student_user_id from existing student_id which currently stores student_profiles.user_id
UPDATE appointments a
SET student_user_id = sp.user_id
FROM student_profiles sp
WHERE a.student_id = sp.user_id;

-- For rows where student_user_id is still null and student_id is a direct auth.users id, set it
UPDATE appointments SET student_user_id = student_id WHERE student_user_id IS NULL AND student_id IS NOT NULL;

-- Now map appointments to availability: find existing availability matching counsellor, day_order, times
-- Note: counsellor_availability now has column counsellor_id referencing counsellor_profiles.id
-- But original appointments.counsellor_id stored counsellor_profiles.user_id. We'll need mapping table to convert.

-- Populate availability_id for appointments where a matching availability exists
-- Join directly to counsellor_profiles to map counsellor user_id -> counsellor_profile.id
UPDATE appointments a
SET availability_id = ca.id
FROM counsellor_availability ca
JOIN counsellor_profiles cp ON ca.counsellor_id = cp.id
WHERE a.day_order_id = ca.day_order_id
  AND a.start_time = ca.start_time
  AND a.end_time = ca.end_time
  AND a.counsellor_id IS NOT NULL
  AND a.counsellor_id = cp.user_id;

-- For appointments still without availability_id, create a new availability row and link it
INSERT INTO counsellor_availability (id, counsellor_id, day_order_id, start_time, end_time, is_available, created_at, updated_at)
SELECT gen_random_uuid(), cp.id, a.day_order_id, a.start_time, a.end_time, true, NOW(), NOW()
FROM appointments a
LEFT JOIN counsellor_profiles cp ON a.counsellor_id = cp.user_id
WHERE a.availability_id IS NULL
  AND a.counsellor_id IS NOT NULL
GROUP BY cp.id, a.day_order_id, a.start_time, a.end_time
ON CONFLICT (counsellor_id, day_order_id, start_time, end_time) DO NOTHING;

-- Re-run update to set availability_id where we just inserted
UPDATE appointments a
SET availability_id = ca.id
FROM counsellor_availability ca
JOIN counsellor_profiles cp ON ca.counsellor_id = cp.id
WHERE a.availability_id IS NULL
  AND a.day_order_id = ca.day_order_id
  AND a.start_time = ca.start_time
  AND a.end_time = ca.end_time
  AND a.counsellor_id = cp.user_id;

-- For appointments with no counsellor info (unlikely), they remain with NULL availability_id and must be handled manually

-- 7. Ensure appointments.student_id references auth.users(id): drop old fk and set new
ALTER TABLE IF EXISTS appointments DROP CONSTRAINT IF EXISTS appointments_student_id_fkey;
ALTER TABLE IF EXISTS appointments DROP COLUMN IF EXISTS student_id;
ALTER TABLE IF EXISTS appointments RENAME COLUMN student_user_id TO student_id;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'appointments_student_id_fkey'
      AND table_name = 'appointments'
  ) THEN
    EXECUTE 'ALTER TABLE appointments ADD CONSTRAINT appointments_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE';
  END IF;
END$$;

-- 8. Now adjust appointments columns: drop counsellor_id, day_order_id, start_time, end_time after mapping
-- Add FK constraint for availability_id (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'appointments_availability_id_fkey'
      AND table_name = 'appointments'
  ) THEN
    EXECUTE 'ALTER TABLE appointments ADD CONSTRAINT appointments_availability_id_fkey FOREIGN KEY (availability_id) REFERENCES counsellor_availability(id) ON DELETE CASCADE';
  END IF;
END$$;

-- Only drop legacy appointment columns AFTER verifying every appointment has an availability_id
-- Drop policies that depend on appointments.student_id before attempting to drop the column
-- These will be recreated (updated) later in the migration
DROP POLICY IF EXISTS "Counsellors can view student profiles" ON student_profiles;
DROP POLICY IF EXISTS "Users can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Counsellors can view student mood" ON mood_tracking;

DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM appointments WHERE availability_id IS NULL;
  IF missing_count = 0 THEN
    -- safe to drop old columns
    EXECUTE 'ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_counsellor_id_fkey';
    EXECUTE 'ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_day_order_id_fkey';
    EXECUTE 'ALTER TABLE appointments DROP COLUMN IF EXISTS counsellor_id';
    EXECUTE 'ALTER TABLE appointments DROP COLUMN IF EXISTS day_order_id';
    EXECUTE 'ALTER TABLE appointments DROP COLUMN IF EXISTS start_time';
    EXECUTE 'ALTER TABLE appointments DROP COLUMN IF EXISTS end_time';
  ELSE
    RAISE NOTICE 'Skipping drop of legacy appointment columns: % appointments without availability_id', missing_count;
  END IF;
END$$;

-- 9. Convert appointments.status to appointment_status enum safely
ALTER TABLE IF EXISTS appointments ALTER COLUMN status SET DEFAULT 'scheduled'::appointment_status;
-- First ensure all current values are in enum (we mapped 'rescheduled' above)
ALTER TABLE IF EXISTS appointments ALTER COLUMN status TYPE appointment_status USING (status::appointment_status);

-- 10. Create unique partial index to prevent double booking on availability_id for active statuses
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_double_booking
ON appointments (availability_id)
WHERE status IN ('scheduled','confirmed','completed');

-- 11. Add requested production indexes
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_day_order ON counsellor_availability(day_order_id);
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_counsellor ON counsellor_availability(counsellor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_student ON appointments(student_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- 12. Ensure created_at and updated_at exist on appointments (they already exist) and other tables handled
ALTER TABLE IF EXISTS appointments ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE IF EXISTS appointments ALTER COLUMN updated_at SET DEFAULT NOW();

-- 13. RLS: Enable RLS and create policies
-- Enable RLS on relevant tables
ALTER TABLE IF EXISTS counsellor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS appointments ENABLE ROW LEVEL SECURITY;

-- Students: can view availability
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'students_can_view_availability' AND schemaname = 'public' AND tablename = 'counsellor_availability'
  ) THEN
    EXECUTE $policy$CREATE POLICY "students_can_view_availability" ON counsellor_availability
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.user_id = auth.uid())
      );$policy$;
  END IF;
END$$;

-- Students: can insert appointment only if student_id = auth.uid()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'students_insert_appointments' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    EXECUTE $policy$CREATE POLICY "students_insert_appointments" ON appointments
      FOR INSERT WITH CHECK (student_id = auth.uid());$policy$;
  END IF;
END$$;

-- Students: can view only their own appointments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'students_view_own_appointments' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    EXECUTE $policy$CREATE POLICY "students_view_own_appointments" ON appointments
      FOR SELECT USING (student_id = auth.uid());$policy$;
  END IF;
END$$;

-- Students: can update only their own appointments (e.g., cancel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'students_update_own_appointments' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    EXECUTE $policy$CREATE POLICY "students_update_own_appointments" ON appointments
      FOR UPDATE USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());$policy$;
  END IF;
END$$;

-- Counsellors: can manage only their own availability
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'counsellors_manage_own_availability' AND schemaname = 'public' AND tablename = 'counsellor_availability'
  ) THEN
    EXECUTE $policy$CREATE POLICY "counsellors_manage_own_availability" ON counsellor_availability
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM counsellor_profiles cp WHERE cp.id = counsellor_availability.counsellor_id AND cp.user_id = auth.uid()
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM counsellor_profiles cp WHERE cp.id = NEW.counsellor_id AND cp.user_id = auth.uid()
        )
      );$policy$;
  END IF;
END$$;

-- Counsellors: can view appointments tied to their availability
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'counsellors_view_appointments_for_their_availability' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    EXECUTE $policy$CREATE POLICY "counsellors_view_appointments_for_their_availability" ON appointments
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM counsellor_availability ca JOIN counsellor_profiles cp ON ca.counsellor_id = cp.id
          WHERE ca.id = appointments.availability_id AND cp.user_id = auth.uid()
        )
      );$policy$;
  END IF;
END$$;

-- Admin: full access if using service role (server-side). Note: adapt to your admin scheme if different.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_full_access_counsellor_availability' AND schemaname = 'public' AND tablename = 'counsellor_availability'
  ) THEN
    EXECUTE $policy$CREATE POLICY "admin_full_access_counsellor_availability" ON counsellor_availability
      FOR ALL USING (auth.role() = 'service_role');$policy$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_full_access_appointments' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    EXECUTE $policy$CREATE POLICY "admin_full_access_appointments" ON appointments
      FOR ALL USING (auth.role() = 'service_role');$policy$;
  END IF;
END$$;

-- Recreate/Update policies that were dropped above using new schema (appointments -> availability)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Counsellors can view student profiles' AND schemaname = 'public' AND tablename = 'student_profiles'
  ) THEN
    EXECUTE $policy$CREATE POLICY "Counsellors can view student profiles" ON student_profiles
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM appointments a JOIN counsellor_availability ca ON a.availability_id = ca.id
          JOIN counsellor_profiles cp ON ca.counsellor_id = cp.id
          WHERE cp.user_id = auth.uid()
            AND a.student_id = student_profiles.user_id
        )
      );$policy$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own appointments' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    EXECUTE $policy$CREATE POLICY "Users can view own appointments" ON appointments
      FOR SELECT USING (
        student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM counsellor_availability ca JOIN counsellor_profiles cp ON ca.counsellor_id = cp.id
          WHERE ca.id = appointments.availability_id AND cp.user_id = auth.uid()
        )
      );$policy$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Counsellors can view student mood' AND schemaname = 'public' AND tablename = 'mood_tracking'
  ) THEN
    EXECUTE $policy$CREATE POLICY "Counsellors can view student mood" ON mood_tracking
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM appointments a JOIN counsellor_availability ca ON a.availability_id = ca.id
          JOIN counsellor_profiles cp ON ca.counsellor_id = cp.id
          WHERE a.student_id = mood_tracking.user_id
            AND cp.user_id = auth.uid()
        )
      );$policy$;
  END IF;
END$$;

-- 14. Cleanup: temp table no longer used; nothing to drop
-- (tmp_counsellor_map usage removed in this migration)

COMMIT;

-- Verification queries (run after migration):
-- 1) No appointments with NULL availability_id (unless manual)
-- SELECT COUNT(*) FROM appointments WHERE availability_id IS NULL;
-- 2) No duplicate availability for same counsellor and times
-- SELECT counsellor_id, day_order_id, start_time, end_time, COUNT(*) FROM counsellor_availability GROUP BY counsellor_id, day_order_id, start_time, end_time HAVING COUNT(*) > 1;
-- 3) Check partial unique index exists
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_no_double_booking';

-- End of migration
