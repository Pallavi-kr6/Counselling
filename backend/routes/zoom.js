const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./auth');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get Zoom OAuth Access Token
async function getZoomAccessToken() {
  try {
    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {},
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Zoom access token:', error.response?.data || error.message);
    throw new Error('Failed to get Zoom access token');
  }
}

// Create Zoom meeting via API
async function createZoomMeeting(accessToken, topic, startTime, duration = 30) {
  try {
    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        topic: topic || 'Counselling Session',
        type: 2, // Scheduled meeting
        start_time: startTime,
        duration: duration,
        timezone: 'UTC',
        settings: {
          join_before_host: true,
          participant_video: true,
          host_video: true,
          mute_upon_entry: false,
          waiting_room: false
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      meeting_number: response.data.id.toString(),
      meeting_password: response.data.password,
      start_url: response.data.start_url,
      join_url: response.data.join_url
    };
  } catch (error) {
    console.error('Error creating Zoom meeting:', error.response?.data || error.message);
    throw new Error('Failed to create Zoom meeting');
  }
}

// Create Zoom meeting for appointment
router.post('/create-meeting/:appointmentId', verifyToken, async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;

    // Verify appointment and ownership
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (apptError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const isOwner = appointment.student_id === req.user.userId || 
                    appointment.counsellor_id === req.user.userId;

    if (!isOwner) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if meeting already exists
    const { data: existing, error: checkError } = await supabase
      .from('zoom_meetings')
      .select('*')
      .eq('appointment_id', appointmentId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existing) {
      // Return existing meeting
      return res.json({
        meeting: existing,
        joinUrl: existing.join_url,
        startUrl: existing.start_url
      });
    }

    // Get counsellor and student details for meeting topic
    const { data: counsellorProfile } = await supabase
      .from('counsellor_profiles')
      .select('name')
      .eq('user_id', appointment.counsellor_id)
      .single();

    const { data: studentProfile } = await supabase
      .from('student_profiles')
      .select('name')
      .eq('user_id', appointment.student_id)
      .single();

    const topic = `Counselling Session - ${counsellorProfile?.name || 'Counsellor'} & ${studentProfile?.name || 'Student'}`;
    
    // Calculate meeting start time
    const meetingDateTime = new Date(`${appointment.date}T${appointment.start_time}`);
    const startTime = meetingDateTime.toISOString();
    
    // Calculate duration in minutes
    const start = new Date(`2000-01-01T${appointment.start_time}`);
    const end = new Date(`2000-01-01T${appointment.end_time}`);
    const duration = Math.round((end - start) / 60000); // Convert to minutes

    // Get Zoom access token and create meeting
    const accessToken = await getZoomAccessToken();
    const zoomMeeting = await createZoomMeeting(accessToken, topic, startTime, duration);

    // Create meeting record in database
    const { data: meeting, error } = await supabase
      .from('zoom_meetings')
      .insert({
        appointment_id: appointmentId,
        meeting_number: zoomMeeting.meeting_number,
        meeting_password: zoomMeeting.meeting_password,
        start_url: zoomMeeting.start_url,
        join_url: zoomMeeting.join_url
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      meeting,
      joinUrl: meeting.join_url,
      startUrl: meeting.start_url
    });
  } catch (error) {
    console.error('Create Zoom meeting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get meeting details
router.get('/meeting/:appointmentId', verifyToken, async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;

    // Verify appointment and ownership
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (apptError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const isOwner = appointment.student_id === req.user.userId || 
                    appointment.counsellor_id === req.user.userId;

    if (!isOwner) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: meeting, error } = await supabase
      .from('zoom_meetings')
      .select('*')
      .eq('appointment_id', appointmentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({
      meeting,
      joinUrl: meeting.join_url,
      startUrl: meeting.start_url
    });
  } catch (error) {
    console.error('Get Zoom meeting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export router
module.exports = router;

// Also export functions for use in other routes
module.exports.getZoomAccessToken = getZoomAccessToken;
module.exports.createZoomMeeting = createZoomMeeting;
