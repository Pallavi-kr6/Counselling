/**
 * moodAnalysisJob.js
 * ─────────────────────────────────────────────────────────────
 * Scheduled mood analysis job that runs daily at 02:00 IST.
 *
 * Algorithm:
 *   For every student who has logged mood check-ins in the last 7 days:
 *     1. Group mood_tracking entries by calendar date.
 *     2. Compute the daily average mood score (1–10).
 *     3. Walk consecutive calendar days (most recent first).
 *     4. If a student has ≥ CONSECUTIVE_DAYS_THRESHOLD days ALL below
 *        MOOD_SCORE_THRESHOLD, upsert a row into student_watch_flags.
 *     5. If a previously flagged student now has improved mood for
 *        ≥ RECOVERY_DAYS, mark their flag resolved automatically.
 *
 * Constants (all tuneable via env vars):
 *   MOOD_SCORE_THRESHOLD        default 4   (out of 10)
 *   CONSECUTIVE_DAYS_THRESHOLD  default 3
 *   RECOVERY_DAYS               default 2   (consecutive days above threshold to auto-resolve)
 *   LOOK_BACK_DAYS              default 14  (how far back to load entries)
 *
 * Scheduling:
 *   Uses node-cron (no extra infra needed — runs inside the Node process).
 *   Call startMoodAnalysisJob() from backend/index.js on server start.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const cron       = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

// ── Config ────────────────────────────────────────────────────
const MOOD_SCORE_THRESHOLD       = 2; // out of 5 (1 and 2 trigger it)
const CONSECUTIVE_DAYS_THRESHOLD = Number(process.env.WATCH_CONSECUTIVE_DAYS)     || 3;
const RECOVERY_DAYS              = Number(process.env.WATCH_RECOVERY_DAYS)        || 2;
const LOOK_BACK_DAYS             = Number(process.env.WATCH_LOOK_BACK_DAYS)       || 14;

// ── Supabase (service role) ───────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Helpers ───────────────────────────────────────────────────

/** Returns 'YYYY-MM-DD' string for a Date object */
function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

/** Returns an array of date strings from windowStart to windowEnd (inclusive, ascending) */
function dateRange(windowStart, windowEnd) {
  const days = [];
  const d = new Date(windowStart);
  const end = new Date(windowEnd);
  while (d <= end) {
    days.push(toDateStr(new Date(d)));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/**
 * Groups mood_tracking rows by date and calculates a daily average mood.
 * mood field is an integer 1–10; entries without a mood value are skipped.
 *
 * @param {Array} entries - rows from mood_tracking
 * @returns {Map<string, number>} date → average mood score
 */
function buildDailyAverages(entries) {
  const byDate = new Map();

  for (const entry of entries) {
    const score = parseInt(entry.mood_score, 10);
    const date  = entry.created_at ? entry.created_at.split('T')[0] : null;

    if (!date || isNaN(score)) continue;

    if (!byDate.has(date)) {
      byDate.set(date, { sum: 0, count: 0 });
    }
    const bucket = byDate.get(date);
    bucket.sum   += score;
    bucket.count += 1;
  }

  const averages = new Map();
  for (const [date, { sum, count }] of byDate) {
    averages.set(date, parseFloat((sum / count).toFixed(2)));
  }
  return averages;
}

/**
 * Analyses daily averages for a student.
 * Returns the longest consecutive run of days below threshold ending TODAY
 * (or the most recent day with data).
 *
 * @returns {{
 *   shouldFlag: boolean,
 *   consecutiveDays: number,
 *   avgMoodScore: number,
 *   windowStart: string,
 *   windowEnd: string,
 *   shouldResolve: boolean,
 * }}
 */
function analyseStudentMood(dailyAverages) {
  if (dailyAverages.size === 0) {
    return { shouldFlag: false, shouldResolve: false, consecutiveDays: 0 };
  }

  // Build sorted date list (ascending), only dates with data
  const sortedDates = [...dailyAverages.keys()].sort();

  // ── Check recovery: last RECOVERY_DAYS all above threshold ──
  const recentDates = sortedDates.slice(-RECOVERY_DAYS);
  const hasFullRecoveryWindow = recentDates.length >= RECOVERY_DAYS;
  const isRecovering = hasFullRecoveryWindow &&
    recentDates.every(d => (dailyAverages.get(d) ?? 0) > MOOD_SCORE_THRESHOLD);

  if (isRecovering) {
    return { shouldFlag: false, shouldResolve: true, consecutiveDays: 0 };
  }

  // ── Scan for consecutive low-mood days (walking backwards) ──
  let streak        = 0;
  let streakSum     = 0;
  let streakEnd     = null;
  let streakStart   = null;

  // Walk from most-recent to oldest, stop on gap or above-threshold
  for (let i = sortedDates.length - 1; i >= 0; i--) {
    const date  = sortedDates[i];
    const score = dailyAverages.get(date);

    // Check for date gap (more than 1 day apart)
    if (streakEnd !== null) {
      const prev   = new Date(date);
      const endDay = new Date(streakStart); // the end of last seen day
      prev.setDate(prev.getDate() + 1);
      if (toDateStr(prev) !== streakStart) {
        break; // gap in consecutive days — stop streak
      }
    }

    if (score <= MOOD_SCORE_THRESHOLD) {
      if (streakEnd === null) streakEnd = date;
      streakStart = date;
      streak++;
      streakSum += score;
    } else {
      break; // above threshold — streak is over
    }
  }

  const avgMoodScore = streak > 0
    ? parseFloat((streakSum / streak).toFixed(2))
    : null;

  const shouldFlag = streak >= CONSECUTIVE_DAYS_THRESHOLD;

  return {
    shouldFlag,
    shouldResolve: false,
    consecutiveDays: streak,
    avgMoodScore,
    windowStart: streakStart,
    windowEnd:   streakEnd,
  };
}

// ── Core job ───────────────────────────────────────────────────

async function runMoodAnalysis() {
  const jobStart = Date.now();
  console.log(`\n🔍 [MoodAnalysisJob] Starting at ${new Date().toISOString()}`);

  try {
    // 1. Load all mood check-ins from the last LOOK_BACK_DAYS days
    const lookBackDate = new Date();
    lookBackDate.setDate(lookBackDate.getDate() - LOOK_BACK_DAYS);
    const since = toDateStr(lookBackDate);

    const { data: allEntries, error: fetchError } = await supabase
      .from('mood_logs')
      .select('user_id, mood_score, created_at')
      .gte('created_at', since)
      .not('mood_score', 'is', null)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('[MoodAnalysisJob] Failed to fetch mood entries:', fetchError.message);
      return;
    }

    if (!allEntries || allEntries.length === 0) {
      console.log('[MoodAnalysisJob] No mood entries found in window. Nothing to analyse.');
      return;
    }

    // 2. Group entries by student
    const byStudent = new Map();
    for (const entry of allEntries) {
      if (!byStudent.has(entry.user_id)) byStudent.set(entry.user_id, []);
      byStudent.get(entry.user_id).push(entry);
    }

    console.log(`[MoodAnalysisJob] Analysing ${byStudent.size} students with recent check-ins...`);

    // 3. Fetch existing unresolved flags to decide upsert vs skip
    const { data: existingFlags } = await supabase
      .from('student_watch_flags')
      .select('id, student_id, resolved')
      .eq('resolved', false);

    const flaggedStudents = new Set((existingFlags || []).map(f => f.student_id));

    let flagged    = 0;
    let resolved   = 0;
    let skipped    = 0;
    const errors   = [];

    // 4. Analyse each student
    for (const [studentId, entries] of byStudent) {
      try {
        const dailyAverages = buildDailyAverages(entries);
        const analysis      = analyseStudentMood(dailyAverages);

        if (analysis.shouldResolve && flaggedStudents.has(studentId)) {
          // Auto-resolve: mood has recovered
          const { error } = await supabase
            .from('student_watch_flags')
            .update({ resolved: true, resolved_at: new Date().toISOString() })
            .eq('student_id', studentId)
            .eq('resolved', false);

          if (error) {
            errors.push(`resolve ${studentId}: ${error.message}`);
          } else {
            resolved++;
            console.log(`  ✅ Auto-resolved watch flag for student ${studentId}`);
          }
          continue;
        }

        if (!analysis.shouldFlag) {
          skipped++;
          continue;
        }

        // Build reason string
        const reason = `Average pre-chat mood ${analysis.avgMoodScore}/5 for ${analysis.consecutiveDays} consecutive day${analysis.consecutiveDays > 1 ? 's' : ''} (${analysis.windowStart} → ${analysis.windowEnd}). Threshold: ≤ ${MOOD_SCORE_THRESHOLD}/5.`;

        if (flaggedStudents.has(studentId)) {
          // Update existing flag with fresh data (don't create duplicates)
          const { error } = await supabase
            .from('student_watch_flags')
            .update({
              reason,
              avg_mood_score:   analysis.avgMoodScore,
              consecutive_days: analysis.consecutiveDays,
              mood_window_start: analysis.windowStart,
              mood_window_end:   analysis.windowEnd,
              // Escalate to urgent if streak is very long (>= 2× threshold)
              tag: analysis.consecutiveDays >= CONSECUTIVE_DAYS_THRESHOLD * 2 ? 'urgent' : 'watch',
            })
            .eq('student_id', studentId)
            .eq('resolved', false);

          if (error) errors.push(`update ${studentId}: ${error.message}`);
          else flagged++;
        } else {
          // Insert new flag
          const { error } = await supabase
            .from('student_watch_flags')
            .insert({
              student_id:        studentId,
              tag:               analysis.consecutiveDays >= CONSECUTIVE_DAYS_THRESHOLD * 2 ? 'urgent' : 'watch',
              reason,
              avg_mood_score:    analysis.avgMoodScore,
              consecutive_days:  analysis.consecutiveDays,
              threshold_used:    MOOD_SCORE_THRESHOLD,
              mood_window_start: analysis.windowStart,
              mood_window_end:   analysis.windowEnd,
            });

          if (error) {
            // Unique constraint violation = already flagged (race); skip gracefully
            if (error.code !== '23505') errors.push(`insert ${studentId}: ${error.message}`);
          } else {
            flagged++;
            console.log(`  🚩 Flagged student ${studentId} — mood avg ${analysis.avgMoodScore} for ${analysis.consecutiveDays} days`);
          }
        }
      } catch (studentErr) {
        errors.push(`student ${studentId}: ${studentErr.message}`);
      }
    }

    const elapsed = Date.now() - jobStart;
    console.log(`[MoodAnalysisJob] Done in ${elapsed}ms — flagged: ${flagged}, resolved: ${resolved}, skipped: ${skipped}, errors: ${errors.length}`);
    if (errors.length) console.warn('[MoodAnalysisJob] Errors:', errors);

  } catch (err) {
    console.error('[MoodAnalysisJob] Fatal error:', err.message);
  }
}

// ── Scheduler ─────────────────────────────────────────────────

/**
 * Starts the mood analysis cron job.
 * Call this from backend/index.js after the server starts.
 *
 * Schedule: daily at 02:00 IST (20:30 UTC previous day)
 * Cron:     '30 20 * * *'  (UTC)
 *
 * Set env MOOD_JOB_ENABLED=false to disable without code changes.
 * Set env MOOD_JOB_RUN_ON_START=true to trigger once immediately (dev/test).
 */
function startMoodAnalysisJob() {
  if (process.env.MOOD_JOB_ENABLED === 'false') {
    console.log('ℹ️  [MoodAnalysisJob] Disabled via MOOD_JOB_ENABLED=false');
    return;
  }

  // Daily at 02:00 IST = 20:30 UTC
  cron.schedule('30 20 * * *', () => {
    runMoodAnalysis().catch(err =>
      console.error('[MoodAnalysisJob] Unhandled error in scheduled run:', err)
    );
  }, {
    timezone: 'UTC',
  });

  console.log('✅ [MoodAnalysisJob] Scheduled — runs daily at 02:00 IST');

  // Optionally run once immediately on startup (useful for dev/testing)
  if (process.env.MOOD_JOB_RUN_ON_START === 'true') {
    console.log('🔄 [MoodAnalysisJob] Running immediately (MOOD_JOB_RUN_ON_START=true)...');
    runMoodAnalysis().catch(console.error);
  }
}

module.exports = { startMoodAnalysisJob, runMoodAnalysis };
