-- ============================================================
-- REMOVE A COUNSELLOR AND ALL THEIR DATA
-- ============================================================
-- Replace the placeholder with the counsellor's email OR teacher_id,
-- then run the script in Supabase SQL Editor.
-- Run the PREVIEW section first to see what will be deleted.

-- --------------------
-- PREVIEW (run first)
-- --------------------
-- Identify the counsellor and see what will be removed.
-- Replace 'counsellor@example.com' with their email, or use teacher_id below.

SELECT 'Counsellor (profile + user)' AS what, cp.id AS profile_id, u.id AS user_id, cp.name, cp.teacher_id, u.email
FROM counsellor_profiles cp
JOIN users u ON u.id = cp.user_id
WHERE u.email = 'counsellor@example.com'
   OR cp.teacher_id = 'TCH123';

-- Count related rows (use the user_id from the query above in the next 4 queries)
/*
SELECT COUNT(*) AS appointments_count FROM appointments WHERE counsellor_id = 'PASTE_USER_ID_HERE';
SELECT COUNT(*) AS availability_count FROM counsellor_availability ca
  JOIN counsellor_profiles cp ON cp.id = ca.counsellor_id OR cp.user_id = ca.counsellor_id
  WHERE cp.user_id = 'PASTE_USER_ID_HERE';
SELECT COUNT(*) AS progress_reports_count FROM progress_reports WHERE counsellor_id = 'PASTE_USER_ID_HERE';
SELECT COUNT(*) AS session_feedback_count FROM session_feedback WHERE counsellor_id = 'PASTE_USER_ID_HERE';
*/

-- --------------------
-- DELETE (run when sure)
-- --------------------
-- Option A: By counsellor EMAIL (deletes in safe order; works even if availability uses profile id)

DO $$
DECLARE
  v_user_id   UUID;
  v_profile_id UUID;
BEGIN
  -- Resolve counsellor by email (change to your counsellor's email)
  SELECT u.id, cp.id INTO v_user_id, v_profile_id
  FROM users u
  JOIN counsellor_profiles cp ON cp.user_id = u.id
  WHERE u.email = 'counsellor@example.com';  -- <-- CHANGE THIS

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Counsellor not found for the given email';
  END IF;

  -- 1) Zoom meetings (via appointments)
  DELETE FROM zoom_meetings
  WHERE appointment_id IN (SELECT id FROM appointments WHERE counsellor_id = v_user_id);

  -- 2) Session feedback for this counsellor
  DELETE FROM session_feedback WHERE counsellor_id = v_user_id;

  -- 3) Progress reports for this counsellor
  DELETE FROM progress_reports WHERE counsellor_id = v_user_id;

  -- 4) Appointments for this counsellor
  DELETE FROM appointments WHERE counsellor_id = v_user_id;

  -- 5) Availability: try by profile id first (your DB may use counsellor_profiles.id)
  DELETE FROM counsellor_availability WHERE counsellor_id = v_profile_id;
  -- If the above deleted 0 rows, your DB may use user_id in availability:
  DELETE FROM counsellor_availability WHERE counsellor_id = v_user_id;

  -- 6) Counsellor profile
  DELETE FROM counsellor_profiles WHERE user_id = v_user_id;

  -- 7) User row
  DELETE FROM users WHERE id = v_user_id;

  RAISE NOTICE 'Counsellor and all related data removed. user_id was %', v_user_id;
END $$;

-- --------------------
-- Option B: By TEACHER_ID (if you prefer to identify by teacher_id)
-- --------------------
/*
DO $$
DECLARE
  v_user_id   UUID;
  v_profile_id UUID;
BEGIN
  SELECT user_id, id INTO v_user_id, v_profile_id
  FROM counsellor_profiles
  WHERE teacher_id = 'TCH123';  -- <-- CHANGE THIS

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Counsellor not found for the given teacher_id';
  END IF;

  DELETE FROM zoom_meetings WHERE appointment_id IN (SELECT id FROM appointments WHERE counsellor_id = v_user_id);
  DELETE FROM session_feedback WHERE counsellor_id = v_user_id;
  DELETE FROM progress_reports WHERE counsellor_id = v_user_id;
  DELETE FROM appointments WHERE counsellor_id = v_user_id;
  DELETE FROM counsellor_availability WHERE counsellor_id = v_profile_id;
  DELETE FROM counsellor_availability WHERE counsellor_id = v_user_id;
  DELETE FROM counsellor_profiles WHERE user_id = v_user_id;
  DELETE FROM users WHERE id = v_user_id;

  RAISE NOTICE 'Counsellor and all related data removed.';
END $$;
*/
