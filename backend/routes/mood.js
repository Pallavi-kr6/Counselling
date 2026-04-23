const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./auth');
const Anthropic = require('@anthropic-ai/sdk');

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
       
     if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

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

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

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

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

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

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

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

// Get AI mood logs trend data for Recharts
router.get('/ai-logs-trend', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: moodLogs, error } = await supabase
      .from('mood_tracking')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(50); // Get latest 50 logs for trend analysis

    if (error && error.code !== 'PGRST116') throw error;

    res.json({ logs: moodLogs || [] });
  } catch (error) {
    console.error('Fetch AI mood logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Claude AI generated micro-insight for average mood
router.get('/insight', verifyToken, async (req, res) => {
  try {
    const { score } = req.query;
    if (!score) return res.status(400).json({ error: 'Score is required' });

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'empty',
    });

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `In one gentle sentence, interpret an average mood score of ${score}/10 for a student`
        }],
      });
      res.json({ insight: response.content[0].text });
    } catch (apiError) {
      console.error('Claude API Error:', apiError);
      res.json({ insight: `Your average heartspace feeling is around ${score}/10.` });
    }
  } catch (error) {
    console.error('Fetch mood insight error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get gentle insight based on recent moods sequence
router.get('/gentle-insight', verifyToken, async (req, res) => {
  try {
    const { moods } = req.query;
    if (!moods) return res.status(400).json({ error: 'Moods string is required' });

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'empty',
    });

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `A student's recent moods in order were: ${moods}. Write one warm, non-clinical sentence of encouragement that acknowledges what they've been feeling. Do not give advice. Max 25 words.`
        }],
      });
      res.json({ insight: response.content[0].text });
    } catch (apiError) {
      console.error('Claude API gentle-insight Error:', apiError);
      res.json({ insight: "You've been experiencing a mix of emotions lately, and we want you to know it's perfectly okay to feel exactly as you do." });
    }
  } catch (error) {
    console.error('Fetch gentle insight error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all check-in dates for streak calculation
router.get('/streak-dates', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { data, error } = await supabase
      .from('mood_tracking')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    // Get unique dates
    const dates = [...new Set(data.map(entry => entry.date))];
    res.json({ dates });
  } catch (error) {
    console.error('Fetch streak dates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
