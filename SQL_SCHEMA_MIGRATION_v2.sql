-- ============================================================================
-- Supabase PostgreSQL Schema Migration for Counselling Portal
-- Purpose: Fix counsellor_availability and appointments constraints
-- Description: Allow multiple time slots per counselor per day order,
--              and prevent double-booking of appointments
-- ============================================================================

-- ============================================================================
-- PHASE 1: BACKUP VERIFICATION (Run these checks BEFORE migration)
-- ============================================================================

-- Check current unique constraints on counsellor_availability
-- Expected: constraint_name like '..._unique' with columns (counsellor_id, day_order_id)
SELECT constraint_name, table_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'counsellor_availability' AND constraint_type = 'UNIQUE';

-- Check current data in counsellor_availability
-- Note: Document this if you need to roll back
SELECT COUNT(*) as total_availability_records FROM counsellor_availability;
SELECT counsellor_id, day_order_id, COUNT(*) as slot_count
FROM counsellor_availability
GROUP BY counsellor_id, day_order_id
HAVING COUNT(*) > 1;

-- Check current appointments count
SELECT COUNT(*) as total_appointments FROM appointments;
SELECT COUNT(*) as non_cancelled_appointments 
FROM appointments 
WHERE status IN ('scheduled', 'confirmed', 'completed');

-- ============================================================================
-- PHASE 2: DROP OLD CONSTRAINTS SAFELY
-- ============================================================================

-- Drop the old incorrect UNIQUE constraint on counsellor_availability
-- This constraint prevented multiple time slots per day order
ALTER TABLE IF EXISTS counsellor_availability
DROP CONSTRAINT IF EXISTS counsellor_availability_unique CASCADE;

-- Note: If the constraint has a different name, find it using:
-- SELECT constraint_name FROM information_schema.table_constraints
-- WHERE table_name = 'counsellor_availability' AND constraint_type = 'UNIQUE';
-- Then uncomment and use the specific name:
-- ALTER TABLE counsellor_availability 
-- DROP CONSTRAINT IF EXISTS "your_constraint_name" CASCADE;

-- ============================================================================
-- PHASE 3: ADD NEW CONSTRAINTS
-- ============================================================================

-- Add the corrected UNIQUE constraint to counsellor_availability
-- This allows multiple time slots for the same counselor on the same day order
-- but prevents duplicate identical time slots
ALTER TABLE counsellor_availability
ADD CONSTRAINT counsellor_availability_unique 
UNIQUE (counsellor_id, day_order_id, start_time, end_time);

-- ============================================================================
-- PHASE 4: ADD APPOINTMENT CONSTRAINTS (PREVENT DOUBLE BOOKING)
-- ============================================================================

-- Option 1: Partial Unique Index (RECOMMENDED)
-- This prevents double-booking only for active appointments
-- Cancelled/rescheduled appointments don't count
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_no_double_booking
ON appointments (counsellor_id, date, start_time, end_time)
WHERE status IN ('scheduled', 'confirmed', 'completed');

-- Option 2: Alternative - Check constraint (if partial index not suitable)
-- This check prevents overlapping time slots for active appointments
-- Note: This is more conservative and prevents any overlap
-- Uncomment if you prefer this approach over the partial index
-- ALTER TABLE appointments
-- ADD CONSTRAINT check_no_overlapping_slots
-- CHECK (
--   NOT EXISTS (
--     SELECT 1 FROM appointments AS a2
--     WHERE a2.counsellor_id = counsellor_id
--     AND a2.date = date
--     AND a2.id != id
--     AND a2.status IN ('scheduled', 'confirmed', 'completed')
--     AND (start_time, end_time) OVERLAPS (a2.start_time, a2.end_time)
--   )
-- );

-- ============================================================================
-- PHASE 5: PERFORMANCE INDEXES
-- ============================================================================

-- Indexes for counsellor_availability table
-- Used when fetching available slots by day order
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_day_order_active
ON counsellor_availability (day_order_id, is_available)
WHERE is_available = true;

-- Index for finding counsellor's availability for a specific day order
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_counsellor_day_order
ON counsellor_availability (counsellor_id, day_order_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_times
ON counsellor_availability (start_time, end_time);

-- ============================================================================
-- Indexes for appointments table
-- Used when checking for existing bookings
-- ============================================================================

-- Index for checking if a slot is already booked
CREATE INDEX IF NOT EXISTS idx_appointments_slot_check
ON appointments (counsellor_id, date, start_time, end_time)
WHERE status IN ('scheduled', 'confirmed', 'completed');

-- Index for finding appointments by day order
CREATE INDEX IF NOT EXISTS idx_appointments_day_order
ON appointments (day_order_id, date);

-- Index for finding student's appointments
CREATE INDEX IF NOT EXISTS idx_appointments_student_active
ON appointments (student_id, status)
WHERE status IN ('scheduled', 'confirmed', 'completed');

-- Index for finding counsellor's appointments
CREATE INDEX IF NOT EXISTS idx_appointments_counsellor_date
ON appointments (counsellor_id, date, status);

-- ============================================================================
-- PHASE 6: VERIFICATION QUERIES (Run AFTER migration)
-- ============================================================================

-- Verify new constraints exist
SELECT constraint_name, table_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name IN ('counsellor_availability', 'appointments')
ORDER BY table_name, constraint_name;

-- Verify indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('counsellor_availability', 'appointments')
AND indexname LIKE '%idx_%'
ORDER BY tablename, indexname;

-- Check for any constraint violations (should return 0 rows)
-- This checks if there are multiple identical time slots
SELECT counsellor_id, day_order_id, start_time, end_time, COUNT(*) as duplicate_count
FROM counsellor_availability
GROUP BY counsellor_id, day_order_id, start_time, end_time
HAVING COUNT(*) > 1;

-- Check for any double-booked appointments
-- This should return 0 rows
SELECT 
  COUNT(*) as double_booked_count
FROM appointments a1
WHERE a1.status IN ('scheduled', 'confirmed', 'completed')
AND EXISTS (
  SELECT 1 FROM appointments a2
  WHERE a2.counsellor_id = a1.counsellor_id
  AND a2.date = a1.date
  AND a2.id != a1.id
  AND a2.status IN ('scheduled', 'confirmed', 'completed')
  AND (a1.start_time, a1.end_time) OVERLAPS (a2.start_time, a2.end_time)
);

-- ============================================================================
-- PHASE 7: SCHEMA DOCUMENTATION
-- ============================================================================

-- Current schema after migration
-- counsellor_availability:
-- - Allows multiple time slots per counselor per day order
-- - Prevents duplicates: UNIQUE(counsellor_id, day_order_id, start_time, end_time)
-- - Indexed for fast lookups by day_order_id, counsellor_id, and time

-- appointments:
-- - Prevents double-booking via partial unique index
-- - Only active appointments (scheduled/confirmed/completed) are protected
-- - Cancelled/rescheduled appointments can be safely ignored
-- - Multiple indexes for fast queries by student, counsellor, date, and day order
