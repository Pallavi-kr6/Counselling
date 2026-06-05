const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Student submits a platform review
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res.status(403).json({ error: 'Only students can submit platform reviews' });
    }

    const { rating, suggestion } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const { data, error } = await supabase
      .from('platform_reviews')
      .insert({
        student_id: req.user.userId,
        rating,
        suggestion: suggestion || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Platform review insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ review: data });
  } catch (error) {
    console.error('Submit platform review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Counsellors view all student platform reviews
router.get('/', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'counsellor' && req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data, error } = await supabase
      .from('platform_reviews')
      .select('id, rating, suggestion, created_at, student_id')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Platform reviews fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    const reviews = data || [];
    const studentIds = [...new Set(reviews.map((r) => r.student_id))];

    let profileMap = {};
    if (studentIds.length > 0) {
      const { data: profiles } = await supabase
        .from('student_profiles')
        .select('user_id, name, department')
        .in('user_id', studentIds);

      profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
    }

    const enriched = reviews.map((r) => ({
      ...r,
      profile: profileMap[r.student_id] || null,
    }));

    const ratings = enriched.map((r) => r.rating);
    const averageRating = ratings.length
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;

    res.json({
      reviews: enriched,
      averageRating,
      totalReviews: enriched.length,
    });
  } catch (error) {
    console.error('Get platform reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
