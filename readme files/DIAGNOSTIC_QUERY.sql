-- ============================================
-- DIAGNOSTIC QUERY: Check Counsellor Availability
-- ============================================
-- Run this in Supabase SQL Editor to diagnose why slots show 0

-- Step 1: Check all day orders and their UUIDs
SELECT 
  id,
  order_name,
  order_number,
  is_active
FROM day_orders
ORDER BY order_number;

-- Step 2: Check counsellor availability records
-- Replace 'YOUR_DAY_ORDER_ID' with one of the UUIDs from Step 1
SELECT 
  ca.id,
  ca.counsellor_id,
  cp.name AS counsellor_name,
  ca.day_order_id,
  do.order_name,
  ca.start_time,
  ca.end_time,
  ca.is_available,
  ca.created_at
FROM counsellor_availability ca
LEFT JOIN counsellor_profiles cp ON ca.counsellor_id = cp.user_id
LEFT JOIN day_orders do ON ca.day_order_id = do.id
ORDER BY cp.name, do.order_number, ca.start_time;

-- Step 3: Check if day_order_id matches correctly
-- This should show NO rows if everything is correct
-- If you see rows, those have mismatched day_order_id
SELECT 
  ca.id,
  ca.counsellor_id,
  cp.name AS counsellor_name,
  ca.day_order_id,
  'MISMATCHED - day_order_id not found in day_orders' AS issue
FROM counsellor_availability ca
LEFT JOIN counsellor_profiles cp ON ca.counsellor_id = cp.user_id
WHERE ca.day_order_id NOT IN (SELECT id FROM day_orders);

-- Step 4: Check for invalid time ranges (end_time <= start_time)
SELECT 
  ca.id,
  cp.name AS counsellor_name,
  do.order_name,
  ca.start_time,
  ca.end_time,
  'INVALID - end_time must be after start_time' AS issue
FROM counsellor_availability ca
LEFT JOIN counsellor_profiles cp ON ca.counsellor_id = cp.user_id
LEFT JOIN day_orders do ON ca.day_order_id = do.id
WHERE ca.end_time <= ca.start_time;

-- Step 5: Check appointments for a specific date (replace date)
SELECT 
  a.id,
  cp.name AS counsellor_name,
  a.date,
  a.start_time,
  a.end_time,
  a.status
FROM appointments a
LEFT JOIN counsellor_profiles cp ON a.counsellor_id = cp.user_id
WHERE a.date = '2026-02-20'  -- Change this to your test date
  AND a.status IN ('scheduled', 'confirmed')
ORDER BY a.counsellor_id, a.start_time;

-- Step 6: Full diagnostic - Show everything for a specific day order
-- Replace 'YOUR_DAY_ORDER_ID' with actual UUID from Step 1
SELECT 
  do.order_name,
  cp.name AS counsellor_name,
  cp.user_id AS counsellor_id,
  ca.start_time AS availability_start,
  ca.end_time AS availability_end,
  ca.is_available,
  COUNT(a.id) AS booked_appointments_count,
  STRING_AGG(a.start_time || '-' || a.end_time, ', ') AS booked_times
FROM day_orders do
LEFT JOIN counsellor_availability ca ON ca.day_order_id = do.id AND ca.is_available = true
LEFT JOIN counsellor_profiles cp ON ca.counsellor_id = cp.user_id
LEFT JOIN appointments a ON a.counsellor_id = cp.user_id 
  AND a.date = '2026-02-20'  -- Change to your test date
  AND a.status IN ('scheduled', 'confirmed')
WHERE do.id = 'YOUR_DAY_ORDER_ID'  -- Replace with actual UUID
GROUP BY do.order_name, cp.name, cp.user_id, ca.start_time, ca.end_time, ca.is_available
ORDER BY cp.name;
