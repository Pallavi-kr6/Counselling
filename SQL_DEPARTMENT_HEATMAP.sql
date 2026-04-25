-- ─────────────────────────────────────────────────────────────
-- SQL Migration: Department Mood Heatmap RPC
-- Purpose: Supabase RPC function that aggregates mood_logs and
--          crisis_alerts per department per month.
--          Called via: supabase.rpc('get_department_mood_heatmap')
--          Privacy: Returns ONLY aggregate stats — no student
--          names, emails, or individual row data.
-- Run once in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_department_mood_heatmap(months_back INTEGER DEFAULT 6)
RETURNS TABLE(
  department   TEXT,
  month_key    TEXT,       -- 'YYYY-MM'
  avg_mood     NUMERIC,    -- average mood score (1–10), NULL if no logs
  alert_count  BIGINT,     -- number of crisis alerts that month
  entry_count  BIGINT      -- number of mood_log entries that month
)
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as the function owner (service role), bypasses student RLS
AS $$
BEGIN
  RETURN QUERY
  WITH

  -- ── Mood log aggregation ────────────────────────────────────
  mood_agg AS (
    SELECT
      sp.department,
      TO_CHAR(DATE_TRUNC('month', ml.created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_key,
      ROUND(AVG(ml.score)::NUMERIC, 2)  AS avg_mood,
      COUNT(ml.id)                      AS entry_count
    FROM mood_logs ml
    INNER JOIN student_profiles sp ON sp.user_id = ml.user_id
    WHERE
      sp.department IS NOT NULL
      AND TRIM(sp.department) <> ''
      AND ml.created_at >= DATE_TRUNC('month', NOW() - ((months_back || ' months')::INTERVAL))
    GROUP BY sp.department, DATE_TRUNC('month', ml.created_at AT TIME ZONE 'UTC')
  ),

  -- ── Crisis alert aggregation ────────────────────────────────
  crisis_agg AS (
    SELECT
      sp.department,
      TO_CHAR(DATE_TRUNC('month', ca.created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_key,
      COUNT(ca.id) AS alert_count
    FROM crisis_alerts ca
    INNER JOIN student_profiles sp ON sp.user_id = ca.student_id
    WHERE
      sp.department IS NOT NULL
      AND TRIM(sp.department) <> ''
      AND ca.created_at >= DATE_TRUNC('month', NOW() - ((months_back || ' months')::INTERVAL))
    GROUP BY sp.department, DATE_TRUNC('month', ca.created_at AT TIME ZONE 'UTC')
  )

  -- ── Full outer join to include months with mood OR alerts ──
  SELECT
    COALESCE(m.department,  c.department)  AS department,
    COALESCE(m.month_key,   c.month_key)   AS month_key,
    COALESCE(m.avg_mood,    NULL)           AS avg_mood,
    COALESCE(c.alert_count, 0)             AS alert_count,
    COALESCE(m.entry_count, 0)             AS entry_count
  FROM mood_agg m
  FULL OUTER JOIN crisis_agg c
    ON  m.department = c.department
    AND m.month_key  = c.month_key
  ORDER BY department ASC, month_key ASC;
END;
$$;

-- Grant execute to authenticated users (backend uses service role so this is belt-and-braces)
GRANT EXECUTE ON FUNCTION get_department_mood_heatmap(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_mood_heatmap(INTEGER) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- Verification (run after migration):
-- SELECT * FROM get_department_mood_heatmap(6);
-- ─────────────────────────────────────────────────────────────
