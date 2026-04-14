const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Submit mood check-in
router.post('/check-in', verifyToken, async (req, res) => {
  try {
    const { mood, emoji, notes, stressLevel, sleepHours } = req.body;

    if (!mood && !emoji) {
      return res.status(400).json({ error: 'Mood or emoji required' });
    }

    const { data, error } = await supabase
      .from('mood_tracking')
      .insert({
        user_id: req.user.userId,
        mood: mood || null,
        emoji: emoji || null,
        notes: notes || null,
        stress_level: stressLevel || null,
        sleep_hours: sleepHours || null,
        date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ checkIn: data });
  } catch (error) {
    console.error('Mood check-in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get mood history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.userId;

    let query = supabase
      .from('mood_tracking')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query.limit(30); // Last 30 entries

    if (error) throw error;

    res.json({ history: data || [] });
  } catch (error) {
    console.error('Get mood history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get mood dashboard data
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const userId = req.user.userId;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get mood entries
    const { data: entries, error } = await supabase
      .from('mood_tracking')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    // Calculate statistics
    const stats = calculateMoodStats(entries || []);

    res.json({
      entries: entries || [],
      stats
    });
  } catch (error) {
    console.error('Get mood dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get student mood report (for counsellors)
router.get('/student/:studentId', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Only counsellors can view student reports' });
    }

    const { days = 30 } = req.query;
    const studentId = req.params.studentId;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const { data: entries, error } = await supabase
      .from('mood_tracking')
      .select('*')
      .eq('user_id', studentId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) throw error;

    const stats = calculateMoodStats(entries || []);

    res.json({
      entries: entries || [],
      stats
    });
  } catch (error) {
    console.error('Get student mood report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function calculateMoodStats(entries) {
  if (!entries || entries.length === 0) {
    return {
      averageMood: null,
      averageStress: null,
      averageSleep: null,
      trend: 'stable'
    };
  }

  const moods = entries.filter(e => e.mood).map(e => parseInt(e.mood));
  const stressLevels = entries.filter(e => e.stress_level).map(e => parseInt(e.stress_level));
  const sleepHours = entries.filter(e => e.sleep_hours).map(e => parseFloat(e.sleep_hours));

  const averageMood = moods.length > 0 
    ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(2)
    : null;

  const averageStress = stressLevels.length > 0
    ? (stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length).toFixed(2)
    : null;

  const averageSleep = sleepHours.length > 0
    ? (sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length).toFixed(2)
    : null;

  // Calculate trend (simplified)
  let trend = 'stable';
  if (entries.length >= 2) {
    const recent = entries.slice(0, Math.floor(entries.length / 2));
    const older = entries.slice(Math.floor(entries.length / 2));
    const recentAvg = recent.filter(e => e.mood).reduce((a, e) => a + parseInt(e.mood), 0) / recent.filter(e => e.mood).length;
    const olderAvg = older.filter(e => e.mood).reduce((a, e) => a + parseInt(e.mood), 0) / older.filter(e => e.mood).length;
    
    if (recentAvg > olderAvg + 0.5) trend = 'improving';
    else if (recentAvg < olderAvg - 0.5) trend = 'declining';
  }

  return {
    averageMood,
    averageStress,
    averageSleep,
    trend,
    totalEntries: entries.length
  };
}

module.exports = router;
