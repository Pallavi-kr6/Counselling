-- ============================================================================
-- Fix appointment time zone sync for India-local counselling slots
-- ============================================================================
-- Problem:
--   Booking 09:00 Asia/Kolkata stores start_datetime as 03:30Z. The previous
--   trigger copied TIME(start_datetime) back into start_time, so the website
--   showed 03:30 instead of 09:00.
--
-- This migration keeps date/start_time/end_time as Asia/Kolkata wall-clock
-- fields and stores start_datetime/end_datetime as the corresponding UTC
-- instants.
-- ============================================================================

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

DROP TRIGGER IF EXISTS sync_datetime_on_insert_update ON public.appointments;

-- Repair appointments affected by the old UTC-clock overwrite.
UPDATE public.appointments
SET
  date = (start_datetime AT TIME ZONE 'Asia/Kolkata')::DATE,
  start_time = (start_datetime AT TIME ZONE 'Asia/Kolkata')::TIME,
  end_time = (end_datetime AT TIME ZONE 'Asia/Kolkata')::TIME
WHERE start_datetime IS NOT NULL
  AND end_datetime IS NOT NULL;
