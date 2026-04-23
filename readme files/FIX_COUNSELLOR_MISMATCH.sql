-- ============================================
-- FIX: Counsellor ID Mismatch
-- ============================================

-- Step 1: Check what counsellor_ids are in availability table
SELECT DISTINCT 
  counsellor_id,
  COUNT(*) AS availability_count
FROM counsellor_availability
GROUP BY counsellor_id;

-- Step 2: Check what user_ids exist in counsellor_profiles
SELECT 
  user_id,
  name,
  designation,
  department
FROM counsellor_profiles
ORDER BY name;

-- Step 3: Find orphaned availability records (no matching counsellor profile)
SELECT 
  ca.id AS availability_id,
  ca.counsellor_id,
  ca.day_order_id,
  do.order_name,
  ca.start_time,
  ca.end_time,
  ca.is_available,
  'NO MATCHING COUNSELLOR PROFILE' AS issue
FROM counsellor_availability ca
LEFT JOIN day_orders do ON ca.day_order_id = do.id
WHERE ca.counsellor_id NOT IN (SELECT user_id FROM counsellor_profiles)
   OR ca.counsellor_id IS NULL;

-- Step 4: If you have a counsellor profile, update the availability to match
-- Replace 'YOUR_COUNSELLOR_USER_ID' with actual user_id from Step 2
-- Replace 'ORPHANED_COUNSELLOR_ID' with counsellor_id from Step 3 that needs fixing

-- EXAMPLE (uncomment and modify):
-- UPDATE counsellor_availability
-- SET counsellor_id = 'YOUR_COUNSELLOR_USER_ID'  -- Correct UUID from counsellor_profiles
-- WHERE counsellor_id = 'ORPHANED_COUNSELLOR_ID';  -- Wrong UUID from availability table

-- Step 5: Verify the fix worked
SELECT 
  ca.id,
  ca.counsellor_id,
  cp.name AS counsellor_name,
  do.order_name,
  ca.start_time,
  ca.end_time,
  ca.is_available
FROM counsellor_availability ca
LEFT JOIN counsellor_profiles cp ON ca.counsellor_id = cp.user_id
LEFT JOIN day_orders do ON ca.day_order_id = do.id
ORDER BY cp.name, do.order_name, ca.start_time;
