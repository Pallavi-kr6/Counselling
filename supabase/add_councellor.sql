-- ============================================================
-- ADD NEW COUNSELLOR WITH USER, PROFILE, AND DAY ORDER SLOTS
-- ============================================================
-- Edit the values in the CTEs below, then run the whole script.

DO $$
DECLARE
  v_user_id     UUID;
  v_profile_id  UUID;
  v_day_order_id UUID;
BEGIN
  -- 1) Create user (change email; user_id will be generated)
  INSERT INTO users (email, user_type, is_anonymous)
  VALUES ('new.counsellor@college.edu', 'counsellor', false)
  ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
  RETURNING id INTO v_user_id;

  -- If ON CONFLICT fired, get existing user id
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM users WHERE email = 'new.counsellor@college.edu';
  END IF;

  -- 2) Create counsellor profile (edit name, designation, etc.)
  INSERT INTO counsellor_profiles (
    user_id, name, designation, teacher_id, gmail, room_no, phone_no, department
  )
  VALUES (
    v_user_id,
    'Dr. Counsellor Name',
    'Counsellor',
    'TCH005',
    'new.counsellor@college.edu',
    '201',
    '9876543210',
    'CSE'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    designation = EXCLUDED.designation,
    teacher_id = EXCLUDED.teacher_id,
    gmail = EXCLUDED.gmail,
    room_no = EXCLUDED.room_no,
    phone_no = EXCLUDED.phone_no,
    department = EXCLUDED.department
  RETURNING id INTO v_profile_id;

  IF v_profile_id IS NULL THEN
    SELECT id INTO v_profile_id FROM counsellor_profiles WHERE user_id = v_user_id;
  END IF;

  -- 3) Add availability for Day Order 1 (09:00–12:00)
  SELECT id INTO v_day_order_id FROM day_orders WHERE order_number = 1 LIMIT 1;
  IF v_day_order_id IS NOT NULL THEN
    INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
    VALUES (v_profile_id, v_day_order_id, '09:00', '12:00', true)
    ON CONFLICT (counsellor_id, day_order_id, start_time, end_time) DO NOTHING;
  END IF;

  -- 4) Add availability for Day Order 2 (13:00–16:00)
  SELECT id INTO v_day_order_id FROM day_orders WHERE order_number = 2 LIMIT 1;
  IF v_day_order_id IS NOT NULL THEN
    INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
    VALUES (v_profile_id, v_day_order_id, '13:00', '16:00', true)
    ON CONFLICT (counsellor_id, day_order_id, start_time, end_time) DO NOTHING;
  END IF;

  -- 5) Add availability for Day Order 5 (10:00–11:30) – optional
  SELECT id INTO v_day_order_id FROM day_orders WHERE order_number = 5 LIMIT 1;
  IF v_day_order_id IS NOT NULL THEN
    INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
    VALUES (v_profile_id, v_day_order_id, '10:00', '11:30', true)
    ON CONFLICT (counsellor_id, day_order_id, start_time, end_time) DO NOTHING;
  END IF;

  RAISE NOTICE 'Counsellor created: user_id %, profile_id %', v_user_id, v_profile_id;
END $$;

-- Option B: Simple step‑by‑step (copy‑paste one block at a time)
-- Step 1 – Create user
INSERT INTO users (email, user_type, is_anonymous)
VALUES ('new.counsellor@college.edu', 'counsellor', false)
RETURNING id;
--Step 2 – Create profile
INSERT INTO counsellor_profiles (
  user_id, name, designation, teacher_id, gmail, room_no, phone_no, department
)
VALUES (
  'USER_ID',                    -- paste from step 1
  'Dr. Counsellor Name',
  'Counsellor',
  'TCH005',
  'new.counsellor@college.edu',
  '201',
  '9876543210',
  'CSE'
)
RETURNING id, user_id, name;

--Step 3 – Get day order IDs
SELECT id, order_name, order_number FROM day_orders ORDER BY order_number;

--Step 4 – Add availability (one block per day order)
-- Day Order 1: 09:00–12:00
INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
VALUES ('PROFILE_ID', 'DAY_ORDER_1_UUID', '09:00', '12:00', true);

-- Day Order 2: 13:00–16:00
INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
VALUES ('PROFILE_ID', 'DAY_ORDER_2_UUID', '13:00', '16:00', true);

-- Day Order 5: 10:00–11:30
INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
VALUES ('PROFILE_ID', 'DAY_ORDER_5_UUID', '10:00', '11:30', true);