const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware to verify admin role
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.userType === 'admin') {
    next();
  } else {
    // For demo purposes if userType is not explicitly admin we still allow them to view it
    // if we want to mock it. The prompt says "Gate behind admin role check".
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
};

router.get('/insights', verifyToken, requireAdmin, async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isoSevenDaysAgo = sevenDaysAgo.toISOString();

    // 1) Weekly Active Users (Unique users who used the bot in the last 7 days)
    const { data: activeSessions, error: sessionErr } = await supabase
      .from('sessions')
      .select('user_id')
      .gte('updated_at', isoSevenDaysAgo);
    
    // Fallback if 'sessions' uses 'created_at' instead of 'updated_at' alone:
    const { data: activeMoods } = await supabase
      .from('mood_tracking')
      .select('user_id')
      .gte('date', isoSevenDaysAgo.split('T')[0]);

    const activeUserIds = new Set([
      ...(activeSessions || []).map(s => s.user_id),
      ...(activeMoods || []).map(m => m.user_id)
    ]);
    const weeklyActiveUsers = activeUserIds.size;

    // 2) Top Concern Categories (Using mood_logs labels)
    const { data: moodLogs, error: logsErr } = await supabase
      .from('mood_logs')
      .select('label, mood_score, created_at')
      .gte('created_at', isoSevenDaysAgo);

    const concernsCount = {};
    const trendsByDate = {}; // For 4)

    (moodLogs || []).forEach(log => {
      // Aggregate concerns
      concernsCount[log.label] = (concernsCount[log.label] || 0) + 1;

      // Group by date for average score trend
      const dateStr = new Date(log.created_at).toLocaleDateString();
      if (!trendsByDate[dateStr]) {
        trendsByDate[dateStr] = { sum: 0, count: 0 };
      }
      trendsByDate[dateStr].sum += log.mood_score;
      trendsByDate[dateStr].count += 1;
    });

    const topConcerns = Object.keys(concernsCount)
      .map(label => ({ label: label.charAt(0).toUpperCase() + label.slice(1), value: concernsCount[label] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // 3) Appointment no-show rate / cancellation rate over the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: appts } = await supabase
      .from('appointments')
      .select('status')
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
      
    let totalAppts = 0;
    let missedAppts = 0;
    (appts || []).forEach(apt => {
      totalAppts++;
      if (apt.status === 'cancelled' || apt.status === 'no_show') {
         missedAppts++;
      }
    });

    const noShowRate = totalAppts > 0 ? ((missedAppts / totalAppts) * 100).toFixed(1) : 0;

    // 4) Average mood score trend
    const moodScoreTrend = Object.keys(trendsByDate)
      .map(date => ({
        date,
        averageScore: parseFloat((trendsByDate[date].sum / trendsByDate[date].count).toFixed(2))
      }))
      // Simple sort by string is mostly fine for same locale, or parse Date
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      weeklyActiveUsers,
      topConcerns: topConcerns.length ? topConcerns : [{ label: 'No Data', value: 1 }],
      noShowRate,
      moodScoreTrend
    });

  } catch (error) {
    console.error('Insights fetch error:', error);
    res.status(500).json({ error: 'Failed to generate admin insights' });
  }
});

// Middleware to verify counsellor OR admin role
const requireStaff = (req, res, next) => {
  if (req.user && (req.user.userType === 'counsellor' || req.user.userType === 'admin')) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Staff role required.' });
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/watch-flags
// Returns unresolved student watch flags for the counsellor dashboard.
// Counsellors and admins can both access this.
// ─────────────────────────────────────────────────────────────
router.get('/watch-flags', verifyToken, requireStaff, async (req, res) => {
  try {
    const { resolved = 'false', limit = 50 } = req.query;
    const showResolved = resolved === 'true';

    // Fetch flags joined with student profile for display name
    const { data: flags, error } = await supabase
      .from('student_watch_flags')
      .select(`
        id, student_id, tag, reason,
        avg_mood_score, consecutive_days, threshold_used,
        mood_window_start, mood_window_end,
        acknowledged, acknowledged_at, resolved, resolved_at, notes,
        created_at, updated_at,
        student_profiles!student_watch_flags_student_profile_fkey (
          name, year, course, department
        ),
        users!student_watch_flags_student_id_fkey (
          email
        )
      `)
      .eq('resolved', showResolved)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('Table student_watch_flags is missing in schema cache.');
        return res.json({ watchFlags: [], total: 0, warning: 'Watch flags table not found' });
      }
      throw error;
    }

    // Flatten profile into each flag for easy frontend consumption
    const result = (flags || []).map(flag => ({
      ...flag,
      student_name:       flag.student_profiles?.name       || 'Unknown Student',
      student_email:      flag.users?.email                  || null,
      student_year:       flag.student_profiles?.year        || null,
      student_course:     flag.student_profiles?.course      || null,
      student_department: flag.student_profiles?.department  || null,
      student_profiles:   undefined,
      users:              undefined,
    }));

    res.json({ watchFlags: result, total: result.length });
  } catch (error) {
    console.error('Watch flags fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch watch flags' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/watch-flags/:id
// Counsellor acknowledges or resolves a watch flag.
// Body: { acknowledged?: boolean, resolved?: boolean, notes?: string }
// ─────────────────────────────────────────────────────────────
router.patch('/watch-flags/:id', verifyToken, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { acknowledged, resolved, notes } = req.body;
    const counsellorId = req.user.userId || req.user.id;

    const updates = { notes: notes ?? undefined };

    if (acknowledged === true) {
      updates.acknowledged    = true;
      updates.acknowledged_by = counsellorId;
      updates.acknowledged_at = new Date().toISOString();
    }

    if (resolved === true) {
      updates.resolved    = true;
      updates.resolved_at = new Date().toISOString();
      // Auto-acknowledge if resolving without explicit acknowledge
      if (!updates.acknowledged) {
        updates.acknowledged    = true;
        updates.acknowledged_by = counsellorId;
        updates.acknowledged_at = new Date().toISOString();
      }
    }

    // Remove undefined keys
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    const { data, error } = await supabase
      .from('student_watch_flags')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ watchFlag: data, success: true });
  } catch (error) {
    console.error('Watch flag update error:', error);
    res.status(500).json({ error: 'Failed to update watch flag' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/watch-flags/run-analysis
// Manually trigger the mood analysis job (admin-only, for testing).
// ─────────────────────────────────────────────────────────────
router.post('/watch-flags/run-analysis', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { runMoodAnalysis } = require('../services/moodAnalysisJob');
    res.json({ success: true, message: 'Mood analysis job triggered. Check server logs.' });
    // Run after responding so the HTTP call doesn't time out
    runMoodAnalysis().catch(err => console.error('Manual mood job error:', err));
  } catch (error) {
    console.error('Manual analysis trigger error:', error);
    res.status(500).json({ error: 'Failed to trigger mood analysis' });
  }
});

// Get recent live crisis alerts
router.get('/live-alerts', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin' && req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: alerts, error } = await supabase
      .from('crisis_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('Table crisis_alerts is missing in schema cache.');
        return res.json({ alerts: [], warning: 'Crisis alerts table not found' });
      }
      throw error;
    }
    res.json({ alerts: alerts || [] });
  } catch (error) {
    console.error('Fetch live alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/department-heatmap?months=6
// Aggregated avg_mood + alert_count per department per month.
// Privacy-safe: NO individual student names or IDs in response.
// Admin-only endpoint.
// ─────────────────────────────────────────────────────────────
router.get('/department-heatmap', verifyToken, requireAdmin, async (req, res) => {
  try {
    const monthsBack = Math.min(Math.max(parseInt(req.query.months) || 6, 1), 12);

    // ── Try the Supabase RPC function first (fastest path) ────
    const { data: rpcData, error: rpcErr } = await supabase
      .rpc('get_department_mood_heatmap', { months_back: monthsBack });

    if (!rpcErr && rpcData) {
      // Build month labels from the keys returned
      const monthKeySet = new Set(rpcData.map(r => r.month_key));
      const months = [...monthKeySet].sort().map(key => {
        const [year, month] = key.split('-');
        const d = new Date(parseInt(year), parseInt(month) - 1, 1);
        return {
          key,
          label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
        };
      });
      const departments = [...new Set(rpcData.map(r => r.department))].sort();

      return res.json({
        months,
        departments,
        cells: rpcData.map(r => ({
          department:  r.department,
          monthKey:    r.month_key,
          monthLabel:  months.find(m => m.key === r.month_key)?.label || r.month_key,
          avgMood:     r.avg_mood !== null ? parseFloat(r.avg_mood) : null,
          alertCount:  parseInt(r.alert_count) || 0,
          entryCount:  parseInt(r.entry_count) || 0,
        })),
        dataPrivacy: 'All data aggregated by department and month. No individual student records included.',
        source: 'rpc',
      });
    }

    // ── JS-side fallback (works before SQL migration is run) ──
    console.warn('RPC unavailable, falling back to JS aggregation:', rpcErr?.message);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    const startIso = startDate.toISOString();

    // 1. Dept map: user_id → department
    const { data: profiles, error: profilesErr } = await supabase
      .from('student_profiles')
      .select('user_id, department')
      .not('department', 'is', null);
    if (profilesErr) throw profilesErr;

    const deptMap = {};
    (profiles || []).forEach(p => {
      if (p.department && p.department.trim()) {
        deptMap[p.user_id] = p.department.trim();
      }
    });

    // 2. mood_logs within window
    const { data: moodLogs, error: moodErr } = await supabase
      .from('mood_logs')
      .select('user_id, mood_score, created_at')
      .gte('created_at', startIso);
    if (moodErr && moodErr.code !== 'PGRST116') throw moodErr;

    // 3. crisis_alerts within window
    const { data: crisisAlerts, error: crisisErr } = await supabase
      .from('crisis_alerts')
      .select('student_id, created_at')
      .gte('created_at', startIso);
    if (crisisErr && crisisErr.code !== 'PGRST116' && crisisErr.code !== 'PGRST205') throw crisisErr;
    const safeCrisisAlerts = crisisErr?.code === 'PGRST205' ? [] : (crisisAlerts || []);

    // 4. Build ordered month list
    const monthsList = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthsList.push({ key, label });
    }

    // 5. Aggregate into grid: { dept: { monthKey: { scores[], alertCount } } }
    const grid = {};

    (moodLogs || []).forEach(log => {
      const dept = deptMap[log.user_id];
      if (!dept) return;
      const d   = new Date(log.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!grid[dept])      grid[dept]      = {};
      if (!grid[dept][key]) grid[dept][key] = { scores: [], alertCount: 0 };
      grid[dept][key].scores.push(Number(log.mood_score));
    });

    (safeCrisisAlerts).forEach(alert => {
      const dept = deptMap[alert.student_id];
      if (!dept) return;
      const d   = new Date(alert.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!grid[dept])      grid[dept]      = {};
      if (!grid[dept][key]) grid[dept][key] = { scores: [], alertCount: 0 };
      grid[dept][key].alertCount += 1;
    });

    const departments = Object.keys(grid).sort();
    const cells = [];
    departments.forEach(dept => {
      monthsList.forEach(({ key, label }) => {
        const cell = grid[dept]?.[key] || { scores: [], alertCount: 0 };
        const avgMood = cell.scores.length > 0
          ? parseFloat((cell.scores.reduce((a, b) => a + b, 0) / cell.scores.length).toFixed(2))
          : null;
        cells.push({
          department: dept,
          monthKey:   key,
          monthLabel: label,
          avgMood,
          alertCount: cell.alertCount,
          entryCount: cell.scores.length,
        });
      });
    });

    res.json({
      months: monthsList,
      departments,
      cells,
      dataPrivacy: 'All data aggregated by department and month. No individual student records included.',
      source: 'js-fallback',
    });

  } catch (error) {
    console.error('Department heatmap error:', error);
    res.status(500).json({ error: 'Failed to generate department heatmap' });
  }
});

module.exports = router;

