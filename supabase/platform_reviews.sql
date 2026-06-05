-- Platform reviews: students rate MindSpace when leaving the site
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.platform_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  suggestion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_reviews_created
  ON public.platform_reviews(created_at DESC);

-- ── Row Level Security ─────────────────────────────────────────
ALTER TABLE public.platform_reviews ENABLE ROW LEVEL SECURITY;

-- Backend API (service role key) — full access
DROP POLICY IF EXISTS "service_role_full_access" ON public.platform_reviews;
CREATE POLICY "service_role_full_access"
  ON public.platform_reviews FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Students may submit a review for themselves only
DROP POLICY IF EXISTS "students_insert_own_platform_review" ON public.platform_reviews;
CREATE POLICY "students_insert_own_platform_review"
  ON public.platform_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.user_type = 'student'
    )
  );

-- Students may read their own reviews
DROP POLICY IF EXISTS "students_select_own_platform_review" ON public.platform_reviews;
CREATE POLICY "students_select_own_platform_review"
  ON public.platform_reviews FOR SELECT
  USING (auth.uid() = student_id);

-- Counsellors and admins may read all reviews (Student Echoes page)
DROP POLICY IF EXISTS "staff_select_platform_reviews" ON public.platform_reviews;
CREATE POLICY "staff_select_platform_reviews"
  ON public.platform_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.user_type IN ('counsellor', 'admin')
    )
  );
