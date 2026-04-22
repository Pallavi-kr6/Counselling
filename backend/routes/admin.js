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
      .from('mood_tracking')
      .select('label, score, created_at')
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
      trendsByDate[dateStr].sum += log.score;
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

module.exports = router;
