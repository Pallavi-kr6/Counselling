const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Submit feedback for a session
router.post('/', verifyToken, async (req, res) => {
  try {
    const { appointmentId, rating, comment, isAnonymous } = req.body;

    if (!appointmentId || !rating) {
      return res.status(400).json({ error: 'Appointment ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Verify appointment belongs to user
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('student_id', req.user.userId)
      .single();

    if (apptError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if feedback already exists
    const { data: existing, error: checkError } = await supabase
      .from('session_feedback')
      .select('id')
      .eq('appointment_id', appointmentId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    let result;
    if (existing) {
      // Update existing feedback
      const { data, error } = await supabase
        .from('session_feedback')
        .update({
          rating,
          comment: comment || null,
          is_anonymous: isAnonymous || false
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new feedback
      const { data, error } = await supabase
        .from('session_feedback')
        .insert({
          appointment_id: appointmentId,
          student_id: req.user.userId,
          counsellor_id: appointment.counsellor_id,
          rating,
          comment: comment || null,
          is_anonymous: isAnonymous || false
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({ feedback: result });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get feedback for a counsellor
router.get('/counsellor/:counsellorId', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'counsellor' && req.user.userId !== req.params.counsellorId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data, error } = await supabase
      .from('session_feedback')
      .select(`
        *,
        appointment:appointments(date, start_time)
      `)
      .eq('counsellor_id', req.params.counsellorId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate average rating
    const ratings = data?.map(f => f.rating) || [];
    const averageRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)
      : null;

    res.json({
      feedback: data || [],
      averageRating,
      totalFeedback: data?.length || 0
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
