-- ============================================================================
-- Migration: Add proper datetime fields to appointments table
-- ============================================================================
-- This migration adds start_datetime and end_datetime fields to support
-- accurate datetime-based appointment scheduling and classification.
--
-- Backward Compatibility: Old fields (date, start_time, end_time) are kept
-- for now and populated from the new datetime fields.
-- ============================================================================

-- Step 1: Add new datetime columns (nullable initially)
ALTER TABLE appointments
ADD COLUMN start_datetime TIMESTAMP WITH TIME ZONE,
ADD COLUMN end_datetime TIMESTAMP WITH TIME ZONE;

-- Step 2: Populate new datetime columns from existing date + time fields
-- This assumes all existing appointments are stored with valid date/time
UPDATE appointments
SET 
  start_datetime = (date || 'T' || start_time)::TIMESTAMP WITH TIME ZONE,
  end_datetime = (date || 'T' || end_time)::TIMESTAMP WITH TIME ZONE
WHERE date IS NOT NULL 
  AND start_time IS NOT NULL 
  AND end_time IS NOT NULL;

-- Step 3: Add constraints to ensure new fields are populated
ALTER TABLE appointments
ALTER COLUMN start_datetime SET NOT NULL,
ALTER COLUMN end_datetime SET NOT NULL;

-- Step 4: Add index for efficient querying on datetime fields
CREATE INDEX idx_appointments_start_datetime ON appointments(start_datetime);
CREATE INDEX idx_appointments_end_datetime ON appointments(end_datetime);
CREATE INDEX idx_appointments_start_end ON appointments(start_datetime, end_datetime);

-- Step 5: Add check constraint to ensure end_datetime > start_datetime
ALTER TABLE appointments
ADD CONSTRAINT check_appointment_times CHECK (end_datetime > start_datetime);

-- Optional: Add trigger to automatically update old fields from new datetime fields
-- This helps with gradual migration to new datetime fields
CREATE OR REPLACE FUNCTION sync_datetime_to_date_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.start_datetime IS NOT NULL THEN
    NEW.date = DATE(NEW.start_datetime);
    NEW.start_time = TIME(NEW.start_datetime);
  END IF;
  IF NEW.end_datetime IS NOT NULL THEN
    NEW.end_time = TIME(NEW.end_datetime);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_datetime_on_insert_update
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION sync_datetime_to_date_time();

-- ============================================================================
-- Notes:
-- - All new code should use start_datetime and end_datetime
-- - Legacy code can still use date/start_time/end_time for now
-- - This provides a safe migration path
-- - Next phase: Remove old fields after all code is migrated
-- ============================================================================
