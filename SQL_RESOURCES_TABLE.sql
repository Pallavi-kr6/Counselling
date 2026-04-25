-- ─────────────────────────────────────────────────────────────
-- SQL Migration: Resource Library
-- Adds content_url + is_active to the existing resources table,
-- then seeds it with curated resources in the four categories:
--   stress | anxiety | relationships | academic
-- Run once in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Add new columns (safe — does nothing if they already exist)
ALTER TABLE IF EXISTS resources ADD COLUMN IF NOT EXISTS content_url  TEXT;
ALTER TABLE IF EXISTS resources ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS resources ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Populate content_url from the legacy `url` column
UPDATE resources SET content_url = url WHERE content_url IS NULL AND url IS NOT NULL;

-- 2. Enable RLS and add a policy so authenticated users can read active resources
ALTER TABLE IF EXISTS resources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view active resources'
      AND tablename = 'resources'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can view active resources"
        ON resources FOR SELECT
        USING (is_active = TRUE AND auth.uid() IS NOT NULL);
    $policy$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access on resources'
      AND tablename = 'resources'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Service role full access on resources"
        ON resources FOR ALL
        USING (auth.role() = 'service_role');
    $policy$;
  END IF;
END$$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_resources_category  ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_type      ON resources(type);
CREATE INDEX IF NOT EXISTS idx_resources_is_active ON resources(is_active) WHERE is_active = TRUE;

-- 4. Seed curated resources
--    category ∈ {stress, anxiety, relationships, academic}
--    type     ∈ {article, video, exercise}
INSERT INTO resources (id, title, description, category, content_url, url, type, is_active, created_at)
VALUES

  -- ── STRESS ──────────────────────────────────────────────────
  (
    uuid_generate_v4(),
    'Managing Academic Stress – Dartmouth Wellness',
    'Evidence-based, practical steps to handle workload pressure without overwhelming yourself.',
    'stress',
    'https://students.dartmouth.edu/wellness-center/wellness-mindfulness/relaxation-downloads/managing-academic-stress',
    'https://students.dartmouth.edu/wellness-center/wellness-mindfulness/relaxation-downloads/managing-academic-stress',
    'article', TRUE, NOW()
  ),
  (
    uuid_generate_v4(),
    '5-Minute Stress Relief Breathing',
    'Follow this gentle visual guide to activate your parasympathetic system and lower cortisol quickly.',
    'stress',
    'https://www.youtube.com/watch?v=nmFUDkj1Aq0',
    'https://www.youtube.com/watch?v=nmFUDkj1Aq0',
    'video', TRUE, NOW()
  ),
  (
    uuid_generate_v4(),
    'Box Breathing Exercise (4-4-4-4)',
    'A structured breath exercise used by Navy SEALs to immediately calm the nervous system under pressure.',
    'stress',
    'https://www.healthline.com/health/box-breathing',
    'https://www.healthline.com/health/box-breathing',
    'exercise', TRUE, NOW()
  ),
  (
    uuid_generate_v4(),
    'Student Burnout: Signs & Recovery',
    'Recognise the warning signs of academic burnout and learn science-backed recovery strategies.',
    'stress',
    'https://www.apa.org/monitor/2022/10/beating-student-burnout',
    'https://www.apa.org/monitor/2022/10/beating-student-burnout',
    'article', TRUE, NOW()
  ),

  -- ── ANXIETY ─────────────────────────────────────────────────
  (
    uuid_generate_v4(),
    '5-4-3-2-1 Grounding Technique',
    'Anchor yourself to the present moment using your five senses — instant relief for spiralling thoughts.',
    'anxiety',
    'https://www.urmc.rochester.edu/behavioral-health-partners/bhp-blog/april-2018/5-4-3-2-1-coping-technique-for-anxiety.aspx',
    'https://www.urmc.rochester.edu/behavioral-health-partners/bhp-blog/april-2018/5-4-3-2-1-coping-technique-for-anxiety.aspx',
    'article', TRUE, NOW()
  ),
  (
    uuid_generate_v4(),
    'Guided Anxiety Relief Breathing (2 min)',
    'A calming visual breathing guide — slow, gentle, and perfectly paced to quiet an anxious mind.',
    'anxiety',
    'https://www.youtube.com/watch?v=aNXKjGFUlMs',
    'https://www.youtube.com/watch?v=aNXKjGFUlMs',
    'video', TRUE, NOW()
  ),
  (
    uuid_generate_v4(),
    'Progressive Muscle Relaxation',
    'Systematically tense and release muscle groups to release anxiety stored in your body.',
    'anxiety',
    'https://www.anxietycanada.com/articles/how-to-do-progressive-muscle-relaxation/',
    'https://www.anxietycanada.com/articles/how-to-do-progressive-muscle-relaxation/',
    'exercise', TRUE, NOW()
  ),
  (
    uuid_generate_v4(),
    'Understanding Anxiety: What's Happening in Your Body',
    'A clear, compassionate explanation of the anxiety response and how to work with it, not against it.',
    'anxiety',
    'https://www.mind.org.uk/information-support/types-of-mental-health-problems/anxiety-and-panic-attacks/about-anxiety/',
    'https://www.mind.org.uk/information-support/types-of-mental-health-problems/anxiety-and-panic-attacks/about-anxiety/',
    'article', TRUE, NOW()
  ),

  -- ── RELATIONSHIPS ────────────────────────────────────────────
  (
    uuid_generate_v4(),
    'Navigating Loneliness at University',
    'A research-backed guide to building genuine connection and easing the quiet ache of loneliness in college.',
    'relationships',
    'https://www.psychologytoday.com/us/blog/romantically-attached/202301/how-to-cope-with-loneliness-in-college',
    'https://www.psychologytoday.com/us/blog/romantically-attached/202301/how-to-cope-with-loneliness-in-college',
    'article', TRUE, NOW()
  ),
  (
    uuid_generate_v4(),
    'Setting Healthy Boundaries – BetterHelp Guide',
    'Learn how to express needs, say no without guilt, and build relationships that actually feel safe.',
    'relationships',
    'https://www.betterhelp.com/advice/relations/setting-healthy-boundaries/',
    'https://www.betterhelp.com/advice/relations/setting-healthy-boundaries/',
    'article', TRUE, NOW()
  ),
  (
    uuid_generate_v4(),
    'Expressive Writing for Connection',
    'Use structured journaling prompts to process relationship hurt, loneliness, or conflict.',
    'relationships',
    'https://ggia.berkeley.edu/practice/expressive_writing',
    'https://ggia.berkeley.edu/practice/expressive_writing',
    'exercise', TRUE, NOW()
  ),
  (
    uuid_generate_v4(),
    'How to Communicate Difficult Feelings',
    'A practical video guide on using "I statements" and active listening to navigate hard conversations.',
    'relationships',
    'https://www.youtube.com/watch?v=vlwmfiCb-vc',
    'https://www.youtube.com/watch?v=vlwmfiCb-vc',
    'video', TRUE, NOW()
  ),

  -- ── ACADEMIC ─────────────────────────────────────────────────
  (
    uuid_generate_v4(),
    'Evidence-Based Study Techniques (Retrieval Practice & Spaced Repetition)',
    'Skip the ineffective highlighter. Research shows these two strategies outperform any other study method.',
    'academic',
    'https://learningscientists.org/six-strategies-for-effective-learning',
    'https://learningscientists.org/six-strategies-for-effective-learning',
    'article', TRUE, NOW()
  ),
  (
    uuid_generate_v4(),
    'The Pomodoro Technique – Focus in 25-Minute Bursts',
    'Work in short, intentional sprints with built-in breaks to sustain concentration without burning out.',
    'academic',
    'https://www.youtube.com/watch?v=mNBmG24djoY',
    'https://www.youtube.com/watch?v=mNBmG24djoY',
    'video', TRUE, NOW()
  ),
  (
    uuid_generate_v4(),
    'Weekly Study Planner Exercise',
    'A structured time-blocking exercise to turn overwhelming to-do lists into a manageable weekly plan.',
    'academic',
    'https://www.notion.so/templates/student-dashboard',
    'https://www.notion.so/templates/student-dashboard',
    'exercise', TRUE, NOW()
  ),
  (
    uuid_generate_v4(),
    'Exam Anxiety: Before, During & After',
    'Targeted strategies for each phase of an exam — calm preparation, in-the-moment focus, and healthy recovery.',
    'academic',
    'https://psychcentral.com/anxiety/test-anxiety',
    'https://psychcentral.com/anxiety/test-anxiety',
    'article', TRUE, NOW()
  )

ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Verification:
-- SELECT category, type, COUNT(*) FROM resources WHERE is_active = TRUE GROUP BY category, type ORDER BY category;
-- ─────────────────────────────────────────────────────────────
