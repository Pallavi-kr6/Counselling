-- ============================================================
-- CHANGE COUNSELLOR'S DAY ORDER AVAILABILITY
-- ============================================================

-- --------------------
-- PREVIEW: See current availability
-- --------------------
-- Replace 'TCH123' with the counsellor's teacher_id, or use email below

SELECT 
  cp.name AS counsellor_name,
  cp.teacher_id,
  do.order_name,
  do.order_number,
  ca.id AS availability_id,
  ca.start_time,
  ca.end_time,
  ca.is_available
FROM counsellor_profiles cp
JOIN counsellor_availability ca ON ca.counsellor_id = cp.id  -- profile id
JOIN day_orders do ON do.id = ca.day_order_id
WHERE cp.teacher_id = 'TCH123'  -- <-- CHANGE THIS
ORDER BY do.order_number, ca.start_time;

-- Or by email:
/*
SELECT 
  cp.name AS counsellor_name,
  cp.teacher_id,
  do.order_name,
  do.order_number,
  ca.id AS availability_id,
  ca.start_time,
  ca.end_time,
  ca.is_available
FROM counsellor_profiles cp
JOIN users u ON u.id = cp.user_id
JOIN counsellor_availability ca ON ca.counsellor_id = cp.id
JOIN day_orders do ON do.id = ca.day_order_id
WHERE u.email = 'counsellor@example.com'
ORDER BY do.order_number, ca.start_time;
*/

-- --------------------
-- OPTION 1: Change existing availability to a different day order
-- --------------------
-- Example: Move availability from Day Order 1 to Day Order 3
-- Replace: teacher_id, old_day_order_number, new_day_order_number

DO $$
DECLARE
  v_profile_id UUID;
  v_old_day_order_id UUID;
  v_new_day_order_id UUID;
BEGIN
  -- Get counsellor profile id
  SELECT id INTO v_profile_id
  FROM counsellor_profiles
  WHERE teacher_id = 'TCH123';  -- <-- CHANGE THIS

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Counsellor not found';
  END IF;

  -- Get day order IDs
  SELECT id INTO v_old_day_order_id FROM day_orders WHERE order_number = 1;  -- <-- OLD day order
  SELECT id INTO v_new_day_order_id FROM day_orders WHERE order_number = 3;  -- <-- NEW day order

  IF v_old_day_order_id IS NULL OR v_new_day_order_id IS NULL THEN
    RAISE EXCEPTION 'Day order not found';
  END IF;

  -- Update all availability records for this counsellor from old day order to new day order
  UPDATE counsellor_availability
  SET day_order_id = v_new_day_order_id
  WHERE counsellor_id = v_profile_id
    AND day_order_id = v_old_day_order_id;

  RAISE NOTICE 'Updated availability from Day Order % to Day Order %', 
    (SELECT order_number FROM day_orders WHERE id = v_old_day_order_id),
    (SELECT order_number FROM day_orders WHERE id = v_new_day_order_id);
END $$;

-- --------------------
-- OPTION 2: Add availability for a new day order (keep existing)
-- --------------------
-- Example: Add Day Order 5 availability for a counsellor who already has Day Order 1

DO $$
DECLARE
  v_profile_id UUID;
  v_day_order_id UUID;
BEGIN
  -- Get counsellor profile id
  SELECT id INTO v_profile_id
  FROM counsellor_profiles
  WHERE teacher_id = 'TCH123';  -- <-- CHANGE THIS

  -- Get day order ID
  SELECT id INTO v_day_order_id FROM day_orders WHERE order_number = 5;  -- <-- NEW day order

  IF v_profile_id IS NULL OR v_day_order_id IS NULL THEN
    RAISE EXCEPTION 'Counsellor or day order not found';
  END IF;

  -- Add new availability blocks
  INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
  VALUES
    (v_profile_id, v_day_order_id, '09:00', '12:00', true),
    (v_profile_id, v_day_order_id, '14:00', '16:00', true)
  ON CONFLICT (counsellor_id, day_order_id, start_time, end_time) DO NOTHING;

  RAISE NOTICE 'Added availability for Day Order %', 
    (SELECT order_number FROM day_orders WHERE id = v_day_order_id);
END $$;

-- --------------------
-- OPTION 3: Remove availability for a specific day order
-- --------------------
-- Example: Remove all Day Order 2 availability for a counsellor

DO $$
DECLARE
  v_profile_id UUID;
  v_day_order_id UUID;
  v_deleted_count INT;
BEGIN
  SELECT id INTO v_profile_id
  FROM counsellor_profiles
  WHERE teacher_id = 'TCH123';  -- <-- CHANGE THIS

  SELECT id INTO v_day_order_id FROM day_orders WHERE order_number = 2;  -- <-- Day order to remove

  IF v_profile_id IS NULL OR v_day_order_id IS NULL THEN
    RAISE EXCEPTION 'Counsellor or day order not found';
  END IF;

  DELETE FROM counsellor_availability
  WHERE counsellor_id = v_profile_id
    AND day_order_id = v_day_order_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE 'Removed % availability records for Day Order %', 
    v_deleted_count,
    (SELECT order_number FROM day_orders WHERE id = v_day_order_id);
END $$;

-- --------------------
-- OPTION 4: Replace all day orders for a counsellor
-- --------------------
-- Example: Remove all existing availability and add new day orders

DO $$
DECLARE
  v_profile_id UUID;
BEGIN
  SELECT id INTO v_profile_id
  FROM counsellor_profiles
  WHERE teacher_id = 'TCH123';  -- <-- CHANGE THIS

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Counsellor not found';
  END IF;

  -- Delete all existing availability
  DELETE FROM counsellor_availability WHERE counsellor_id = v_profile_id;

  -- Add new availability for Day Order 1
  INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
  SELECT v_profile_id, id, '09:00', '12:00', true FROM day_orders WHERE order_number = 1;

  -- Add new availability for Day Order 3
  INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
  SELECT v_profile_id, id, '13:00', '16:00', true FROM day_orders WHERE order_number = 3;

  -- Add new availability for Day Order 5
  INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
  SELECT v_profile_id, id, '10:00', '11:30', true FROM day_orders WHERE order_number = 5;

  RAISE NOTICE 'Replaced all availability for counsellor';
END $$;

-- --------------------
-- OPTION 5: Simple UPDATE by availability_id (if you know the exact record)
-- --------------------
-- First, get the availability_id from the PREVIEW query above, then:

UPDATE counsellor_availability
SET day_order_id = (
  SELECT id FROM day_orders WHERE order_number = 3  -- <-- NEW day order number
)
WHERE id = 'AVAILABILITY_ID_HERE';  -- <-- Paste availability_id from preview

-- --------------------
-- OPTION 6: Change day order for specific time slots only
-- --------------------
-- Example: Move only the 09:00-12:00 slot from Day Order 1 to Day Order 2

DO $$
DECLARE
  v_profile_id UUID;
  v_new_day_order_id UUID;
BEGIN
  SELECT id INTO v_profile_id FROM counsellor_profiles WHERE teacher_id = 'TCH123';
  SELECT id INTO v_new_day_order_id FROM day_orders WHERE order_number = 2;

  UPDATE counsellor_availability
  SET day_order_id = v_new_day_order_id
  WHERE counsellor_id = v_profile_id
    AND day_order_id = (SELECT id FROM day_orders WHERE order_number = 1)
    AND start_time = '09:00'
    AND end_time = '12:00';

  RAISE NOTICE 'Updated specific time slot to Day Order 2';
END $$;
