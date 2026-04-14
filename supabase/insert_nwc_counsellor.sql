-- Supabase SQL Command to Insert a New NWC Counsellor
-- Available on all day orders (9-11 AM and 1-3 PM)

-- Run this entire script in Supabase SQL Editor

-- Step 1: Insert the user and get the UUID
WITH new_user AS (
  INSERT INTO users (email, user_type, is_anonymous)
  VALUES ('counsellor.nwc@college.edu', 'counsellor', false)
  RETURNING id AS user_id
),
new_counsellor AS (
  INSERT INTO counsellor_profiles (
    user_id,
    name,
    designation,
    teacher_id,
    gmail,
    room_no,
    phone_no,
    department
  )
  SELECT 
    user_id,
    'NWC Counsellor',
    'Senior Counsellor',
    'NWC001',
    'counsellor.nwc@college.edu',
    'NWC-101',
    '+91-9876543210',
    'NWC'
  FROM new_user
  RETURNING user_id
)
-- Step 2: Insert availability for all day orders
INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
SELECT 
  c.user_id,
  d.id,
  s.start_time,
  s.end_time,
  true
FROM new_counsellor c
CROSS JOIN day_orders d
CROSS JOIN (
  VALUES 
    ('09:00:00'::time, '11:00:00'::time),
    ('13:00:00'::time, '15:00:00'::time)
) AS s(start_time, end_time)
WHERE d.is_active = true
ON CONFLICT DO NOTHING;

-- Verify the insertion
SELECT 
  cp.name,
  cp.department,
  cp.designation,
  do.order_name,
  ca.start_time,
  ca.end_time
FROM counsellor_availability ca
JOIN day_orders do ON ca.day_order_id = do.id
JOIN counsellor_profiles cp ON ca.counsellor_id = cp.user_id
WHERE cp.department = 'NWC'
ORDER BY do.order_number, ca.start_time;
