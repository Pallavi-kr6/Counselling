const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./auth');
const nodemailer = require('nodemailer');
const axios = require('axios');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { buildFollowUpSchedule } = require('../services/followUpService');
const { getDateTime, formatDateTimeForLog, normalizeTime } = require('../utils/dateTimeHelper');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const cleanEnv = (value) => (typeof value === 'string' ? value.trim() : value);
const emailPort = Number(cleanEnv(process.env.EMAIL_PORT)) || 587;
const isSecureSmtp = process.env.EMAIL_SECURE
  ? cleanEnv(process.env.EMAIL_SECURE) === 'true'
  : emailPort === 465;
const emailFrom = cleanEnv(process.env.EMAIL_FROM) || cleanEnv(process.env.EMAIL_USER);
const smtpUser = cleanEnv(process.env.EMAIL_USER) || 'apikey';
const smtpPass = cleanEnv(process.env.EMAIL_PASS) || cleanEnv(process.env.SENDGRID_API_KEY);
const sendgridApiKey = cleanEnv(process.env.SENDGRID_API_KEY) || smtpPass;
const useSendgridHttp = Boolean(sendgridApiKey);

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: emailPort,
  secure: isSecureSmtp,
  auth: {
    user: smtpUser,
    pass: smtpPass
  },
  tls: process.env.NODE_ENV === 'production'
    ? undefined
    : { rejectUnauthorized: false }
});

function parseFromHeader(fromValue) {
  const fromString = String(fromValue || '').trim();
  const parsed = fromString.match(/^(.*)<(.+)>$/);
  if (!parsed) {
    return { email: fromString };
  }
  return {
    name: parsed[1].trim().replace(/^"|"$/g, ''),
    email: parsed[2].trim()
  };
}

async function sendEmail(mailOptions) {
  if (useSendgridHttp) {
    const from = parseFromHeader(mailOptions.from || emailFrom);
    const to = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [{ to: to.filter(Boolean).map((email) => ({ email })) }],
        from,
        subject: mailOptions.subject,
        content: [
          ...(mailOptions.text ? [{ type: 'text/plain', value: mailOptions.text }] : []),
          ...(mailOptions.html ? [{ type: 'text/html', value: mailOptions.html }] : [])
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    return { via: 'sendgrid-http' };
  }

  return transporter.sendMail(mailOptions);
}

function getCounsellorAvailabilityKeys(profile) {
  if (!profile) return [];
  return [...new Set([profile.id, profile.user_id].filter(Boolean))];
}

// Generate Zoom meeting signature
function generateZoomSignature(meetingNumber, role) {
  const apiKey = process.env.ZOOM_SDK_KEY;
  const apiSecret = process.env.ZOOM_SDK_SECRET;
  const timestamp = Date.now() - 30000;
  const msg = Buffer.from(`${apiKey}${meetingNumber}${timestamp}${role}`).toString('base64');
  const hash = crypto.createHmac('sha256', apiSecret).update(msg).digest('base64');
  const signature = Buffer.from(`${apiKey}.${meetingNumber}.${timestamp}.${role}.${hash}`).toString('base64');
  return signature;
}

// Send appointment confirmation email
async function sendAppointmentEmail(studentEmail, counsellorName, date, startTime, endTime, meetingUrl) {
  const mailOptions = {
    from: emailFrom,
    to: studentEmail,
    subject: 'Counselling Appointment Confirmed',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #667eea;">Appointment Confirmed</h2>
        <p>Your counselling appointment has been scheduled successfully.</p>
        <div style="background: #f5f7fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Counsellor:</strong> ${counsellorName}</p>
          <p><strong>Date:</strong> ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
        </div>
        ${meetingUrl ? `<p><strong>Meeting Link:</strong> <a href="${meetingUrl}" style="color: #667eea;">Join Meeting</a></p>` : ''}
        <p style="margin-top: 20px; color: #666;">You will receive a reminder before your appointment.</p>
      </div>
    `
  };

  try {
    await sendEmail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Get available slots for a counsellor
router.get('/slots/:counsellorId', verifyToken, async (req, res) => {
  try {
    const counsellorId = req.params.counsellorId;

    if (!counsellorId || counsellorId === 'undefined') {
      return res.status(400).json({ error: 'Counsellor ID is required' });
    }

    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date is required in query' });
    }

    console.log('Fetching slots for counsellorId:', counsellorId, 'date:', date);

    // FIX: Get ALL availability slots for this counsellor (not just for one day)
    // Then filter to find slots that match the selected day of week
    const { data: profile, error: profileError } = await supabase
      .from('counsellor_profiles')
      .select('id, user_id')
      .eq('user_id', counsellorId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    if (!profile) {
      return res.json({ slots: [], availability: null });
    }

    const availabilityKeys = getCounsellorAvailabilityKeys(profile);

    const { data: allAvailability, error: availError } = await supabase
      .from('counsellor_availability')
      .select('*')
      .in('counsellor_id', availabilityKeys);

    if (availError) {
      console.error('Availability fetch error:', availError);
      throw availError;
    }

    console.log('All availability for counsellor:', allAvailability);

    // Get day orders to map day_order_id to order_number
    const { data: dayOrders } = await supabase
      .from('day_orders')
      .select('id, order_number')
      .eq('is_active', true)
      .order('order_number');

    // Get the day of week (0-6) from the date
    const dayOfWeek = new Date(date).getDay();
    console.log('Day of week:', dayOfWeek);

    // Map day_order_id to order_number and find matching availability
    // For simplicity: we'll use (dayOfWeek % 4) + 1 to map to Day Order 1-4
    // This assumes a 4-day rotation pattern
    const targetOrderNumber = (dayOfWeek % 4) + 1;
    console.log('Target order number:', targetOrderNumber);

    // Find the day_order_id that matches our target order number
    const matchingDayOrder = dayOrders?.find(doe => doe.order_number === targetOrderNumber);
    console.log('Matching day order:', matchingDayOrder);

    // Filter availability to only include slots for the matching day order
    const availability = matchingDayOrder 
      ? allAvailability?.filter(a => a.day_order_id === matchingDayOrder.id)
      : allAvailability;

    console.log('Filtered availability:', availability);

    // Get existing appointments for that date
    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('counsellor_id', counsellorId)
      .eq('date', date)
      .in('status', ['scheduled', 'confirmed']);

    if (apptError) throw apptError;

    // If no availability for this day, return empty slots
    if (!availability || availability.length === 0) {
      return res.json({ slots: [], availability: null });
    }

    // Generate available slots for all matching availability records
    const allSlots = [];
    for (const avail of availability) {
      if (avail.is_available) {
        const slots = generateTimeSlots(avail, appointments || []);
        allSlots.push(...slots);
      }
    }

    console.log('Generated slots:', allSlots);

    res.json({ slots: allSlots, availability: availability[0] || null });
  } catch (error) {
    console.error('Get slots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate time slots based on availability
function generateTimeSlots(availability, bookedAppointments) {
  if (!availability) {
    console.log('  generateTimeSlots: No availability provided');
    return [];
  }

  // Normalize time format (handle both 'HH:MM' and 'HH:MM:SS')
  const normalizeTime = (timeStr) => {
    if (!timeStr) return null;
    // If it's already in HH:MM format, return as is
    if (timeStr.match(/^\d{2}:\d{2}$/)) {
      return timeStr;
    }
    // If it's in HH:MM:SS format, extract HH:MM
    if (timeStr.match(/^\d{2}:\d{2}:\d{2}/)) {
      return timeStr.substring(0, 5);
    }
    return timeStr;
  };

  const startTimeStr = normalizeTime(availability.start_time);
  const endTimeStr = normalizeTime(availability.end_time);

  if (!startTimeStr || !endTimeStr) {
    console.log(`  generateTimeSlots: Invalid time format - start: ${availability.start_time}, end: ${availability.end_time}`);
    return [];
  }

  const startTime = new Date(`2000-01-01T${startTimeStr}:00`);
  const endTime = new Date(`2000-01-01T${endTimeStr}:00`);

  // Check if times are valid
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    console.log(`  generateTimeSlots: Invalid date parsing - start: ${startTimeStr}, end: ${endTimeStr}`);
    return [];
  }

  // Check if end time is after start time
  if (endTime <= startTime) {
    console.log(`  generateTimeSlots: End time must be after start time - start: ${startTimeStr}, end: ${endTimeStr}`);
    return [];
  }

  const slots = [];
  const slotDuration = 30; // 30 minutes per slot
  let currentTime = new Date(startTime);

  while (currentTime < endTime) {
    const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
    const timeString = currentTime.toTimeString().slice(0, 5);

    // Check if slot is booked
    const isBooked = bookedAppointments.some(apt => {
      const aptStartStr = normalizeTime(apt.start_time);
      const aptEndStr = normalizeTime(apt.end_time);
      if (!aptStartStr || !aptEndStr) return false;
      
      const aptStart = new Date(`2000-01-01T${aptStartStr}:00`);
      const aptEnd = new Date(`2000-01-01T${aptEndStr}:00`);
      
      if (isNaN(aptStart.getTime()) || isNaN(aptEnd.getTime())) return false;
      
      return currentTime < aptEnd && slotEnd > aptStart;
    });

    if (!isBooked) {
      slots.push({
        start_time: timeString,
        end_time: slotEnd.toTimeString().slice(0, 5),
        available: true
      });
    }

    currentTime = slotEnd;
  }

  return slots;
}

// Book appointment
router.post('/book', verifyToken, async (req, res) => {
  try {
    const { counsellorId, date, startTime, endTime, notes } = req.body;

    console.log('Booking request:', { counsellorId, date, startTime, endTime, notes, userId: req.user.userId });

    // 🔒 Only students can book appointments
    if (req.user.userType === 'counsellor') {
      return res.status(403).json({ error: 'Only students can book appointments' });
    }

    if (!counsellorId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 🔒 ENSURE student exists in public.users (CRITICAL FIX)
    const studentId = req.user.userId;

    // Check if user exists in users table
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', studentId)
      .single();

    if (!existingUser) {
      const { error: userInsertError } = await supabase
        .from('users')
        .insert({
          id: studentId,
          email: req.user.email || null,
          user_type: 'student',
          is_anonymous: false
        });

      if (userInsertError) {
        console.error('Auto user insert failed:', userInsertError);
        return res.status(500).json({ error: 'User sync failed' });
      }
    }

    // Check if slot is still available (conflict with existing appointments)
    const { data: conflicting, error: checkError } = await supabase
      .from('appointments')
      .select('id')
      .eq('counsellor_id', counsellorId)
      .eq('date', date)
      .in('status', ['scheduled', 'confirmed'])
      .or(`start_time.lte.${startTime},end_time.gte.${endTime}`)
      .limit(1);

    if (checkError) throw checkError;

    if (conflicting && conflicting.length > 0) {
      return res.status(409).json({ error: 'Time slot is no longer available' });
    }

    // Create appointment
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        student_id: req.user.userId,
        counsellor_id: counsellorId,
        date: date,
        start_time: startTime,
        end_time: endTime,
        start_datetime: getDateTime(date, startTime).toISOString(),
        end_datetime: getDateTime(date, endTime).toISOString(),
        status: 'scheduled',
        notes: notes || null
      })
      .select()
      .single();

    console.log('Appointment booked:', { 
      id: appointment?.id, 
      date, 
      startTime, 
      endTime,
      startDateTime: getDateTime(date, startTime).toISOString(),
      endDateTime: getDateTime(date, endTime).toISOString()
    });

    if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

    // Get student and counsellor details for email
    const { data: student } = await supabase
      .from('users')
      .select('email')
      .eq('id', req.user.userId)
      .single();

    const { data: counsellorProfile } = await supabase
      .from('counsellor_profiles')
      .select('name, gmail')
      .eq('user_id', counsellorId)
      .single();

    // Create Zoom meeting automatically using OAuth API
    let zoomMeeting = null;
    try {
      // Import Zoom functions (before router export)
      const zoomHelpers = require('./zoom');
      const getZoomAccessToken = zoomHelpers.getZoomAccessToken;
      const createZoomMeeting = zoomHelpers.createZoomMeeting;
      
      const topic = `Counselling Session - ${counsellorProfile?.name || 'Counsellor'}`;
      const meetingDateTime = getDateTime(date, startTime);
      const startTimeISO = meetingDateTime.toISOString();
      
      // Calculate duration in minutes
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      const duration = Math.round((end - start) / 60000);

      const accessToken = await getZoomAccessToken();
      const zoomData = await createZoomMeeting(accessToken, topic, startTimeISO, duration);

      const { data: zoomMeetingData, error: zoomError } = await supabase
        .from('zoom_meetings')
        .insert({
          appointment_id: appointment.id,
          meeting_number: zoomData.meeting_number,
          meeting_password: zoomData.meeting_password,
          start_url: zoomData.start_url,
          join_url: zoomData.join_url
        })
        .select()
        .single();

      if (!zoomError) {
        zoomMeeting = zoomMeetingData;
      }
    } catch (zoomErr) {
      console.error('Error creating Zoom meeting:', zoomErr);
      // Continue without Zoom meeting - appointment is still created
    }

    // Send confirmation email to student
    if (student && student.email) {
      await sendAppointmentEmail(
        student.email,
        counsellorProfile?.name || 'Counsellor',
        date,
        startTime,
        endTime,
        zoomMeeting?.join_url || null
      );
    }

    // Send email to counsellor if email available
    if (counsellorProfile?.gmail) {
      const counsellorMailOptions = {
        from: emailFrom,
        to: counsellorProfile.gmail,
        subject: 'New Counselling Appointment',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>New Appointment Scheduled</h2>
            <p>You have a new counselling appointment scheduled.</p>
            <div style="background: #f5f7fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
              ${zoomMeeting?.join_url ? `<p><strong>Meeting Link:</strong> <a href="${zoomMeeting.join_url}">Join Meeting</a></p>` : ''}
            </div>
          </div>
        `
      };
      await sendEmail(counsellorMailOptions).catch(console.error);
    }

    res.json({ 
      appointment: {
        ...appointment,
        zoomMeeting: zoomMeeting || null
      }
    });
  } catch (error) {
    console.error('Book appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's appointments
router.get('/my-appointments', verifyToken, async (req, res) => {
  try {
    const isCounsellor = req.user.userType === 'counsellor';
    const idField = isCounsellor ? 'counsellor_id' : 'student_id';

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*')
      .eq(idField, req.user.userId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

     if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

    // Fetch additional info for each appointment
    const appointmentsWithDetails = await Promise.all(
      (appointments || []).map(async (appt) => {
        let student = null;
        let counsellor = null;

        if (isCounsellor) {
          // For counsellor, fetch student details
          const { data: studentProfile } = await supabase
            .from('student_profiles')
            .select('name, year, course')
            .eq('user_id', appt.student_id)
            .single();
          student = studentProfile ? {
            name: studentProfile.name,
            year: studentProfile.year,
            course: studentProfile.course
          } : null;
        } else {
          // For student, fetch counsellor details
          const { data: counsellorProfile } = await supabase
            .from('counsellor_profiles')
            .select('name, designation, department')
            .eq('user_id', appt.counsellor_id)
            .single();
          counsellor = counsellorProfile ? {
            name: counsellorProfile.name,
            designation: counsellorProfile.designation,
            department: counsellorProfile.department
          } : null;
        }

        return {
          ...appt,
          student,
          counsellor
        };
      })
    );

    res.json({ appointments: appointmentsWithDetails });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark appointment as completed (counsellor only)
router.put('/complete/:id', verifyToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;

    // Only counsellors can mark sessions as completed
    if (req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Only counsellors can complete sessions' });
    }

    // Fetch appointment
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Ensure this counsellor owns the appointment
    if (appointment.counsellor_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to modify this appointment' });
    }

    // Check if already completed - prevent duplicate increments
    if (appointment.status === 'completed') {
      return res.status(400).json({ error: 'Session is already completed', alreadyCompleted: true });
    }

    // Check if appointment can be completed (must be scheduled or confirmed)
    if (!['scheduled', 'confirmed'].includes(appointment.status)) {
      return res.status(400).json({ error: `Cannot complete appointment with status: ${appointment.status}` });
    }

    // Update status to completed and schedule the 7-day follow-up workflow
    const followUpSchedule = buildFollowUpSchedule();

    const { data: updated, error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'completed',
        ...followUpSchedule,
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Get student profile to return updated session count
    const { data: studentProfile } = await supabase
      .from('student_profiles')
      .select('user_id, name, year, course, department')
      .eq('user_id', appointment.student_id)
      .single();

    // Get updated session counts for this student
    const { data: allAppointments } = await supabase
      .from('appointments')
      .select('status')
      .eq('student_id', appointment.student_id)
      .eq('counsellor_id', req.user.userId);

    const sessionCounts = {
      completed: 0,
      scheduled: 0,
      cancelled: 0
    };
    
    (allAppointments || []).forEach((apt) => {
      if (apt.status === 'completed') sessionCounts.completed += 1;
      else if (apt.status === 'cancelled') sessionCounts.cancelled += 1;
      else sessionCounts.scheduled += 1;
    });

    res.json({ 
      appointment: updated,
      student: studentProfile,
      sessionCounts
    });
  } catch (error) {
    console.error('Complete appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add secure session notes post-appointment (counsellor only)
router.post('/:id/notes', verifyToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { notes_text, risk_level, next_action } = req.body;

    if (req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Only counsellors can add session notes' });
    }

    // Verify appointment exists and belongs to the counsellor
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('counsellor_id')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.counsellor_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to add notes to this session' });
    }

    const { data, error } = await supabase
      .from('session_notes')
      .insert({
        session_id: appointmentId,
        counsellor_id: req.user.userId,
        notes_text,
        risk_level: risk_level || 'low',
        next_action: next_action || null
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ note: data });
  } catch (error) {
    console.error('Add session notes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get per-student session counts for a counsellor (all statuses)
router.get('/counsellor/session-stats', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Only counsellors can view session stats' });
    }

    const counsellorId = req.user.userId;

    // Get all appointments for this counsellor
    const { data: rows, error } = await supabase
      .from('appointments')
      .select('student_id, status')
      .eq('counsellor_id', counsellorId);

    if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

    const countsMap = new Map();
    (rows || []).forEach((row) => {
      const key = row.student_id;
      if (!key) return;
      const existing = countsMap.get(key) || {
        completed: 0,
        scheduled: 0,
        cancelled: 0
      };
      if (row.status === 'completed') existing.completed += 1;
      else if (row.status === 'cancelled') existing.cancelled += 1;
      else existing.scheduled += 1;
      countsMap.set(key, existing);
    });

    const studentIds = Array.from(countsMap.keys());

    if (studentIds.length === 0) {
      return res.json({ stats: [] });
    }

    // Fetch student profiles
    const { data: profiles, error: profileError } = await supabase
      .from('student_profiles')
      .select('user_id, name, year, course, department')
      .in('user_id', studentIds);

    if (profileError) throw profileError;

    const profileMap = new Map();
    (profiles || []).forEach((p) => {
      profileMap.set(p.user_id, {
        name: p.name,
        year: p.year,
        course: p.course,
        department: p.department
      });
    });

    const stats = studentIds.map((id) => {
      const counts = countsMap.get(id) || { completed: 0, scheduled: 0, cancelled: 0 };
      const profile = profileMap.get(id) || {};
      return {
        studentId: id,
        name: profile.name || 'Unknown Student',
        year: profile.year || null,
        course: profile.course || null,
        department: profile.department || null,
        sessionsCompleted: counts.completed,
        sessionsScheduled: counts.scheduled,
        sessionsCancelled: counts.cancelled
      };
    });

    res.json({ stats });
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Detailed student view for counsellor: profile, session stats, mood history
router.get('/counsellor/student/:studentId', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Only counsellors can view student details' });
    }

    const counsellorId = req.user.userId;
    const studentId = req.params.studentId;

    // Ensure relationship via at least one appointment
    const { data: appts, error: apptError } = await supabase
      .from('appointments')
      .select('id, status')
      .eq('counsellor_id', counsellorId)
      .eq('student_id', studentId);

    if (apptError) throw apptError;

    if (!appts || appts.length === 0) {
      return res.status(403).json({ error: 'Not authorized to view this student' });
    }

    const sessionCounts = { completed: 0, scheduled: 0, cancelled: 0 };
    appts.forEach((a) => {
      if (a.status === 'completed') sessionCounts.completed += 1;
      else if (a.status === 'cancelled') sessionCounts.cancelled += 1;
      else sessionCounts.scheduled += 1;
    });

    // Student profile
    const { data: profile, error: profileError } = await supabase
      .from('student_profiles')
      .select('user_id, name, year, course, department')
      .eq('user_id', studentId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') throw profileError;

    // Recent mood entries (daily check-ins)
    const { data: moods, error: moodError } = await supabase
      .from('mood_tracking')
      .select('date, mood, emoji, notes, stress_level, sleep_hours')
      .eq('user_id', studentId)
      .order('date', { ascending: false })
      .limit(30);

    if (moodError) throw moodError;

    res.json({
      student: profile || { user_id: studentId },
      sessions: sessionCounts,
      moodEntries: moods || []
    });
  } catch (error) {
    console.error('Get student details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reschedule appointment
router.put('/reschedule/:id', verifyToken, async (req, res) => {
  try {
    const { date, startTime, endTime } = req.body;
    const appointmentId = req.params.id;

    // Verify ownership
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (fetchError) throw fetchError;

    const isOwner = appointment.student_id === req.user.userId || 
                    appointment.counsellor_id === req.user.userId;

    if (!isOwner) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if counsellor is available for the new date
    const dayOfWeek = new Date(date).getDay();
    const { data: availability, error: availError } = await supabase
      .from('counsellor_availability')
      .select('is_available')
      .eq('counsellor_id', appointment.counsellor_id)
      .eq('day_order_id', dayOfWeek)
      .single();

    if (availError && availError.code !== 'PGRST116') {
      throw availError;
    }

    if (!availability || !availability.is_available) {
      return res.status(409).json({ error: 'Counsellor is not available on this date' });
    }

    // Check new slot availability
    const { data: conflicting, error: checkError } = await supabase
      .from('appointments')
      .select('id')
      .eq('counsellor_id', appointment.counsellor_id)
      .eq('date', date)
      .neq('id', appointmentId)
      .in('status', ['scheduled', 'confirmed'])
      .or(`start_time.lte.${startTime},end_time.gte.${endTime}`)
      .limit(1);

    if (checkError) throw checkError;

    if (conflicting && conflicting.length > 0) {
      return res.status(409).json({ error: 'Time slot is not available' });
    }

    // Update appointment
    const { data: updated, error } = await supabase
      .from('appointments')
      .update({
        date: date,
        start_time: startTime,
        end_time: endTime,
        status: 'rescheduled'
      })
      .eq('id', appointmentId)
      .select()
      .single();

     if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

    res.json({ appointment: updated });
  } catch (error) {
    console.error('Reschedule appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel appointment
router.put('/cancel/:id', verifyToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;

    // Update appointment status
    const { data: updated, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .select()
      .single();

     if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

    res.json({ appointment: updated });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get appointments for a counsellor
router.get('/counsellor/:userId', verifyToken, async (req, res) => {
  if (req.user.userType !== 'counsellor') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  try {
    console.log('Fetching appointments for counsellor:', req.params.userId);
    console.log('Request user:', req.user);

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('counsellor_id', req.params.userId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    console.log('Appointments query result:', appointments, error);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    // Fetch student details for each appointment
    const appointmentsWithStudents = await Promise.all(
      (appointments || []).map(async (appt) => {
        // First try to get student profile
        let { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('name, email')
          .eq('user_id', appt.student_id)
          .single();

        // If no profile, get basic user info
        if (!studentProfile) {
          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', appt.student_id)
            .single();

          studentProfile = {
            name: userData?.email?.split('@')[0] || 'Unknown Student',
            email: userData?.email || ''
          };
        }

        return {
          ...appt,
          student: studentProfile ? {
            user_id: appt.student_id,
            name: studentProfile.name,
            email: studentProfile.email
          } : null
        };
      })
    );

    res.json({ appointments: appointmentsWithStudents });
  } catch (error) {
    console.error('Get counsellor appointments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get progress reports for counsellor
router.get('/progress-reports', verifyToken, async (req, res) => {
  try {
    const counsellorId = req.user.userId;

    const { data: reports, error } = await supabase
      .from('progress_reports')
      .select(`
        *,
        student:student_profiles(name, year, course, department)
      `)
      .eq('counsellor_id', counsellorId)
      .order('week_start', { ascending: false });

     if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

    res.json({ reports: reports || [] });
  } catch (error) {
    console.error('Get progress reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/progress-reports/:id/pdf', verifyToken, async (req, res) => {
  try {
    const reportId = req.params.id;
    const counsellorId = req.user.userId;

    console.log('Generating PDF for report:', reportId, 'counsellor:', counsellorId);

    // Get the report
    const { data: report, error } = await supabase
      .from('progress_reports')
      .select('*')
      .eq('id', reportId)
      .eq('counsellor_id', counsellorId)
      .single();

    console.log('Report data:', report, 'Error:', error);
if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=progress-report-${report.student_name}-${report.week_start}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Title
    doc.fontSize(16).font('Helvetica-Bold').text('Weekly Counseling Progress Report – Low CGPA Students', { align: 'center' });
    doc.moveDown(2);

    // Student Info
    doc.fontSize(12).font('Helvetica');
    doc.text(`Student Name: ${report.student_name || '__________________________'}`);
    doc.text(`Register Number: ${report.register_number || '________________________'}`);
    doc.text(`Department / Year: ${report.department_year || '______________________'}`);
    doc.text(`Week: ____________ (From ${report.week_start} to ${report.week_end})`);
    doc.text(`Counselor Name: ${report.counsellor_name || '_________________________'}`);
    doc.moveDown(2);

    // 1. Academic Performance
    doc.font('Helvetica-Bold').text('1. Academic Performance');
    doc.font('Helvetica').moveDown(0.5);
    
    const tableTop = doc.y;
    doc.text('Subject', 50, tableTop);
    doc.text('Current Score %', 200, tableTop);
    doc.text('Attendance %', 320, tableTop);
    doc.text('Remarks', 420, tableTop);
    
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    
    let yPos = tableTop + 25;
    if (report.academic_performance && Array.isArray(report.academic_performance)) {
      report.academic_performance.forEach(subject => {
        doc.text(subject.subject || '', 50, yPos);
        doc.text(subject.score || '', 200, yPos);
        doc.text(subject.attendance || '', 320, yPos);
        doc.text(subject.remarks || '', 420, yPos);
        yPos += 20;
      });
    }
    
    // Add empty rows
    for (let i = 0; i < 3; i++) {
      doc.text('', 50, yPos);
      doc.text('', 200, yPos);
      doc.text('', 320, yPos);
      doc.text('', 420, yPos);
      yPos += 20;
    }
    
    doc.moveDown(2);

    // 2. Review of Previous Week's Goals
    doc.font('Helvetica-Bold').text('2. Review of the Previous Week\'s Goals');
    doc.font('Helvetica').moveDown(0.5);
    
    doc.text('Goal', 50, doc.y);
    doc.text('Status', 250, doc.y);
    doc.text('Reason for Status', 350, doc.y);
    
    doc.moveTo(50, doc.y + 15).lineTo(550, doc.y + 15).stroke();
    
    yPos = doc.y + 25;
    if (report.previous_goals_review && Array.isArray(report.previous_goals_review)) {
      report.previous_goals_review.forEach(goal => {
        doc.text(goal.goal || '', 50, yPos, { width: 180 });
        doc.text(goal.status || '', 250, yPos, { width: 80 });
        doc.text(goal.reason || '', 350, yPos, { width: 180 });
        yPos += 30;
      });
    }
    
    // Add empty rows
    for (let i = 0; i < 3; i++) {
      doc.text('', 50, yPos, { width: 180 });
      doc.text('', 250, yPos, { width: 80 });
      doc.text('', 350, yPos, { width: 180 });
      yPos += 30;
    }
    
    doc.moveDown(2);

    // 3. Issues / Challenges
    doc.font('Helvetica-Bold').text('3. Issues / Challenges Faced This Week');
    doc.font('Helvetica').moveDown(0.5);
    
    const issues = report.issues_challenges || [];
    const issueOptions = [
      'Lack of conceptual clarity in subjects',
      'Poor time management',
      'Low attendance/absenteeism',
      'Lack of motivation/confidence',
      'Distractions (social media, gaming, etc.)',
      'Personal / family issues',
      'Health issues'
    ];
    
    issueOptions.forEach(issue => {
      const checked = issues.includes(issue) ? '☑' : '☐';
      doc.text(`${checked} ${issue}`);
    });
    
    doc.text(`Other: ${report.other_issues || '____________________________________________'}`);
    doc.moveDown(2);

    // 4. Counseling & Support Provided
    doc.font('Helvetica-Bold').text('4. Counseling & Support Provided');
    doc.font('Helvetica').moveDown(0.5);
    
    const support = report.counseling_support || {};
    doc.text(`• Academic guidance: ${support.academic_guidance || '_________________________________'}`);
    doc.text(`• Study strategy suggestions: ${support.study_strategy || '_________________________'}`);
    doc.text(`• Motivational support: ${support.motivational_support || '_______________________________'}`);
    doc.text(`• Peer study group / mentorship arrangement: ${support.peer_study || '__________'}`);
    doc.text(`• Parent communication (if needed): ${support.parent_communication || '___________________'}`);
    doc.moveDown(2);

    // 5. Plan & Targets for Next Week
    doc.font('Helvetica-Bold').text('5. Plan & Targets for Next Week');
    doc.font('Helvetica').moveDown(0.5);
    
    doc.text('Goal', 50, doc.y);
    doc.text('Steps to Achieve', 200, doc.y);
    doc.text('Responsible Person', 350, doc.y);
    
    doc.moveTo(50, doc.y + 15).lineTo(550, doc.y + 15).stroke();
    
    yPos = doc.y + 25;
    if (report.next_week_plan && Array.isArray(report.next_week_plan)) {
      report.next_week_plan.forEach(plan => {
        doc.text(plan.goal || '', 50, yPos, { width: 130 });
        doc.text(plan.steps || '', 200, yPos, { width: 130 });
        doc.text(plan.responsible || '', 350, yPos, { width: 130 });
        yPos += 30;
      });
    }
    
    // Add empty rows
    for (let i = 0; i < 3; i++) {
      doc.text('', 50, yPos, { width: 130 });
      doc.text('', 200, yPos, { width: 130 });
      doc.text('', 350, yPos, { width: 130 });
      yPos += 30;
    }
    
    doc.moveDown(2);

    // 6. Counselor's Remarks
    doc.font('Helvetica-Bold').text('6. Counselor\'s Remarks');
    doc.font('Helvetica').moveDown(0.5);
    
    const remarks = report.counsellor_remarks || '';
    const remarkLines = doc.heightOfString(remarks, { width: 500 }) / 12;
    doc.text(remarks, { width: 500 });
    
    // Add empty lines for remarks
    for (let i = 0; i < Math.max(0, 8 - Math.ceil(remarkLines)); i++) {
      doc.text('');
    }
    
    doc.moveDown(2);

    // 7. Student's Commitment
    doc.font('Helvetica-Bold').text('7. Student\'s Commitment');
    doc.font('Helvetica').moveDown(0.5);
    
    const commitment = report.student_commitment ? '☑' : '☐';
    doc.text(`${commitment} "I will follow the agreed plan and take responsibility for my learning."`);
    doc.text(`Signature of Student: ${report.student_signature || '_______________'} Date: ${report.student_signature_date || '___ / ___ / 20__'}`);
    doc.moveDown(2);

    // 8. Counselor's Signature
    doc.font('Helvetica-Bold').text('8. Counselor\'s Signature');
    doc.font('Helvetica').moveDown(0.5);
    
    doc.text(`Name & Signature: ${report.counsellor_signature || '______________________'} Date: ${report.counsellor_signature_date || '___ / ___ / 20__'}`);

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get progress report for specific student and week
router.get( '/progress-reports/:studentId/:weekStart(\\d{4}-\\d{2}-\\d{2})', verifyToken, async (req, res) => {
  try {
    const { studentId, weekStart } = req.params;
    const counsellorId = req.user.userId;

    const { data: report, error } = await supabase
      .from('progress_reports')
      .select('*')
      .eq('student_id', studentId)
      .eq('counsellor_id', counsellorId)
      .eq('week_start', weekStart)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"

    res.json({ report });
  } catch (error) {
    console.error('Get progress report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update progress report
router.post('/progress-reports', verifyToken, async (req, res) => {
  try {
    const counsellorId = req.user.userId;
    const {
      student_id,
      week_start,
      week_end,
      student_name,
      register_number,
      department_year,
      counsellor_name,
      academic_performance,
      previous_goals_review,
      issues_challenges,
      other_issues,
      counseling_support,
      next_week_plan,
      counsellor_remarks,
      student_commitment,
      student_signature,
      student_signature_date,
      counsellor_signature,
      counsellor_signature_date
    } = req.body;

    // Check if report exists
    const { data: existing } = await supabase
      .from('progress_reports')
      .select('id')
      .eq('student_id', student_id)
      .eq('counsellor_id', counsellorId)
      .eq('week_start', week_start)
      .single();

    const reportData = {
      student_id,
      counsellor_id: counsellorId,
      week_start,
      week_end,
      student_name,
      register_number,
      department_year,
      counsellor_name,
      academic_performance,
      previous_goals_review,
      issues_challenges,
      other_issues,
      counseling_support,
      next_week_plan,
      counsellor_remarks,
      student_commitment,
      student_signature,
      student_signature_date,
      counsellor_signature,
      counsellor_signature_date,
      updated_at: new Date().toISOString()
    };

    let result;
    if (existing) {
      // Update
      result = await supabase
        .from('progress_reports')
        .update(reportData)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Create
      result = await supabase
        .from('progress_reports')
        .insert(reportData)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    res.json({ report: result.data });
  } catch (error) {
    console.error('Save progress report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate PDF for progress report

// Get all day orders
router.get('/day-orders', verifyToken, async (req, res) => {
  try {
    const { data: dayOrders, error } = await supabase
      .from('day_orders')
      .select('*')
      .eq('is_active', true)
      .order('order_number');

     if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

    res.json({ dayOrders: dayOrders || [] });
  } catch (error) {
    console.error('Get day orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Step 2: Get counsellors available for a day order ONLY (no slots, no date)
router.get('/day-order/:dayOrderId/counsellors', verifyToken, async (req, res) => {
  console.log('=== DAY ORDER COUNSELLORS ENDPOINT ===');
  console.log('dayOrderId:', req.params.dayOrderId);
  console.log('user:', req.user?.userId, req.user?.userType);
  try {
    const { dayOrderId } = req.params;
    console.log('--- AVAILABILITY QUERY ---');
    const { data: availability, error: availError } = await supabase
      .from('counsellor_availability')
      .select('counsellor_id, day_order_id, is_available, start_time, end_time')
      .eq('day_order_id', dayOrderId)
      .eq('is_available', true);
    console.log('availability count:', availability ? availability.length : 0);
    console.log('availability:', availability);
    if (availError) {
      console.error('availError:', availError);
      throw availError;
    }

    if (!dayOrderId) {
      return res.status(400).json({ error: 'Day order ID is required' });
    }

    if (availError) throw availError;

    if (!availability || availability.length === 0) {
      return res.json({ counsellors: [] });
    }

    const { data: counsellorProfiles, error: profileError } = await supabase
      .from('counsellor_profiles')
      .select('id, user_id, name, designation, department, room_no, phone_no')
      .order('name');

    if (profileError) throw profileError;

    const counsellors = (counsellorProfiles || []).flatMap(cp => {
      const availabilityKeys = getCounsellorAvailabilityKeys(cp);
      const counsellorAvailability = availability.filter(a => availabilityKeys.includes(a.counsellor_id));

      if (counsellorAvailability.length === 0) {
        return [];
      }

      const firstAvail = counsellorAvailability[0];
      return [{
        counsellor_id: cp.user_id,
        counsellor_name: cp.name,
        designation: cp.designation,
        department: cp.department,
        room_no: cp.room_no,
        phone_no: cp.phone_no,
        start_time: firstAvail?.start_time,
        end_time: firstAvail?.end_time
      }];
    });

    res.json({ counsellors });
  } catch (error) {
    console.error('Get day order counsellors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Format time from DB (HH:MM:SS or HH:MM) to HH:MM
function formatTimeHHMM(t) {
  if (!t) return null;
  const s = String(t);
  return s.length >= 5 ? s.substring(0, 5) : s;
}

// Step 4: Get availability blocks for a counsellor on a day order (no splitting; exact DB rows)
router.get('/day-order/:dayOrderId/counsellors/:counsellorId/slots', verifyToken, async (req, res) => {
  try {
    const { dayOrderId, counsellorId } = req.params;

    if (!dayOrderId || !counsellorId) {
      return res.status(400).json({ error: 'Day order ID and counsellor ID are required' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('counsellor_profiles')
      .select('id, user_id')
      .eq('user_id', counsellorId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Counsellor not found' });
    }

    const { data: rows, error: availError } = await supabase
      .from('counsellor_availability')
      .select('id, start_time, end_time')
      .in('counsellor_id', getCounsellorAvailabilityKeys(profile))
      .eq('day_order_id', dayOrderId)
      .eq('is_available', true)
      .order('start_time');

    if (availError) throw availError;

    const slots = (rows || []).map((row) => ({
      availability_id: row.id,
      start_time: formatTimeHHMM(row.start_time),
      end_time: formatTimeHHMM(row.end_time)
    }));

    res.json({ slots });
  } catch (error) {
    console.error('Get counsellor slots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy: Get available counsellors for a specific day order (with slots for a date)
router.get('/day-order/:dayOrderId/available-counsellors', verifyToken, async (req, res) => {
  try {
    const { dayOrderId } = req.params;
    const { date } = req.query;

    if (!dayOrderId) {
      return res.status(400).json({ error: 'Day order ID is required' });
    }

    console.log('Fetching available counsellors for dayOrderId:', dayOrderId, 'date:', date);

    // Get all counsellor availability for this day order
    const { data: availability, error: availError } = await supabase
      .from('counsellor_availability')
      .select('*')
      .eq('day_order_id', dayOrderId)
      .eq('is_available', true);

    if (availError) {
      console.error('Availability fetch error:', availError);
      throw availError;
    }

    console.log('Availability for day order:', availability);

    if (!availability || availability.length === 0) {
      return res.json({ counsellors: [] });
    }

    // Get unique counsellor IDs from availability.
    // IMPORTANT: In the current DB, counsellor_availability.counsellor_id
    // references counsellor_profiles.id (profile PK), not user_id.
    const { data: counsellorProfiles, error: profileError } = await supabase
      .from('counsellor_profiles')
      .select('id, user_id, name, designation, department, room_no, phone_no')
      .order('name');

    if (profileError) throw profileError;

    // Get existing appointments for the date (if provided)
    let bookedAppointments = [];
    if (date) {
      const { data: appointments, error: apptError } = await supabase
        .from('appointments')
        .select('counsellor_id, start_time, end_time')
        .eq('date', date)
        .in('status', ['scheduled', 'confirmed']);

      if (apptError) throw apptError;
      bookedAppointments = appointments || [];
    }

    // Build response with available slots for each counsellor
    const counsellors = (counsellorProfiles || []).flatMap(counsellor => {
      const availabilityKeys = getCounsellorAvailabilityKeys(counsellor);
      const counsellorAvailability = availability.filter(a => availabilityKeys.includes(a.counsellor_id));

      if (counsellorAvailability.length === 0) {
        return [];
      }
      
      console.log(`Processing counsellor ${counsellor.name} (profile id=${counsellor.id}, user id=${counsellor.user_id})`);
      console.log(`Found ${counsellorAvailability.length} availability records`);
      
      // Generate available slots for each availability record
      const allSlots = [];
      for (const avail of counsellorAvailability) {
        console.log(`  Availability: start_time=${avail.start_time}, end_time=${avail.end_time}, is_available=${avail.is_available}`);
        if (avail.is_available) {
          // Appointments.counsellor_id still uses the user_id (as per schema),
          // so filter booked appointments by user_id.
          const bookedForThisCounsellor = bookedAppointments.filter(a => a.counsellor_id === counsellor.user_id);
          console.log(`  Booked appointments for this counsellor: ${bookedForThisCounsellor.length}`);
          const slots = generateTimeSlots(avail, bookedForThisCounsellor);
          console.log(`  Generated ${slots.length} slots`);
          allSlots.push(...slots);
        }
      }

      console.log(`Total slots for ${counsellor.name}: ${allSlots.length}`);

      return [{
        // Expose user_id as counsellor_id to the frontend so the rest of
        // the system continues to use user IDs as counsellor identifiers.
        counsellor_id: counsellor.user_id,
        counsellor_name: counsellor.name,
        designation: counsellor.designation,
        department: counsellor.department,
        room_no: counsellor.room_no,
        phone_no: counsellor.phone_no,
        start_time: counsellorAvailability[0]?.start_time,
        end_time: counsellorAvailability[0]?.end_time,
        is_available: allSlots.length > 0,
        available_slots: allSlots
      }];
    });

    console.log('Returning counsellors:', counsellors.length);
    res.json({ counsellors });
  } catch (error) {
    console.error('Get available counsellors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Book appointment using day order (uses availability_id and exact start_time/end_time from DB)
router.post('/book-day-order', verifyToken, async (req, res) => {
  try {
    const { dayOrderId, counsellorId, date, availability_id, startTime, endTime, notes } = req.body;

    console.log('Booking request (day order):', { dayOrderId, counsellorId, date, availability_id, startTime, endTime, notes, userId: req.user.userId });

    // Only students can book appointments
    if (req.user.userType === 'counsellor') {
      return res.status(403).json({ error: 'Only students can book appointments' });
    }

    if (!dayOrderId || !counsellorId || !date) {
      return res.status(400).json({ error: 'Day order ID, counsellor ID, and date are required' });
    }

    let start_time;
    let end_time;

    if (availability_id) {
      // Use exact times from counsellor_availability row
      const { data: availRow, error: availErr } = await supabase
        .from('counsellor_availability')
        .select('id, counsellor_id, day_order_id, start_time, end_time, is_available')
        .eq('id', availability_id)
        .single();

      if (availErr || !availRow) {
        return res.status(404).json({ error: 'Availability slot not found' });
      }
      if (!availRow.is_available) {
        return res.status(409).json({ error: 'This availability block is no longer available' });
      }

      const { data: profile } = await supabase
        .from('counsellor_profiles')
        .select('id, user_id')
        .eq('user_id', counsellorId)
        .single();

      const availabilityKeys = getCounsellorAvailabilityKeys(profile);

      if (!profile || !availabilityKeys.includes(availRow.counsellor_id) || availRow.day_order_id !== dayOrderId) {
        return res.status(409).json({ error: 'Availability does not match selected counsellor or day order' });
      }

      start_time = formatTimeHHMM(availRow.start_time);
      end_time = formatTimeHHMM(availRow.end_time);
    } else if (startTime && endTime) {
      start_time = formatTimeHHMM(startTime);
      end_time = formatTimeHHMM(endTime);
    } else {
      return res.status(400).json({ error: 'Either availability_id or startTime and endTime are required' });
    }

    // Ensure student exists in users table
    const studentId = req.user.userId;

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', studentId)
      .single();

    if (!existingUser) {
      const { error: userInsertError } = await supabase
        .from('users')
        .insert({
          id: studentId,
          email: req.user.email || null,
          user_type: 'student',
          is_anonymous: false
        });

      if (userInsertError) {
        console.error('Auto user insert failed:', userInsertError);
        return res.status(500).json({ error: 'User sync failed' });
      }
    }

    // Conflict check: overlapping appointments (existing.start_time < new_end AND existing.end_time > new_start)
    const { data: existingAppointments, error: conflictErr } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('counsellor_id', counsellorId)
      .eq('date', date)
      .in('status', ['scheduled', 'confirmed']);

    if (conflictErr) throw conflictErr;

    const normalizeT = (t) => (t && String(t).length >= 5 ? String(t).substring(0, 5) : String(t));
    const newStart = new Date(`2000-01-01T${normalizeT(start_time)}:00`);
    const newEnd = new Date(`2000-01-01T${normalizeT(end_time)}:00`);

    const hasOverlap = (existingAppointments || []).some((apt) => {
      const aptStart = new Date(`2000-01-01T${normalizeT(apt.start_time)}:00`);
      const aptEnd = new Date(`2000-01-01T${normalizeT(apt.end_time)}:00`);
      return aptStart < newEnd && aptEnd > newStart;
    });

    if (hasOverlap) {
      return res.status(409).json({ error: 'Time slot is no longer available' });
    }

    // Create appointment with exact start_time and end_time from DB
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        student_id: req.user.userId,
        counsellor_id: counsellorId,
        day_order_id: dayOrderId,
        date: date,
        start_time: start_time,
        end_time: end_time,
        start_datetime: getDateTime(date, start_time).toISOString(),
        end_datetime: getDateTime(date, end_time).toISOString(),
        status: 'scheduled',
        notes: notes || null
      })
      .select()
      .single();

    console.log('Day-order appointment booked:', { 
      id: appointment?.id, 
      date, 
      startTime: start_time,
      startDateTime: getDateTime(date, start_time).toISOString()
    });

    if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

    // Get student and counsellor details for email
    const { data: student } = await supabase
      .from('users')
      .select('email')
      .eq('id', req.user.userId)
      .single();

    const { data: counsellorProfile } = await supabase
      .from('counsellor_profiles')
      .select('name, gmail')
      .eq('user_id', counsellorId)
      .single();

    // Create Zoom meeting automatically
    let zoomMeeting = null;
    try {
      const zoomHelpers = require('./zoom');
      const getZoomAccessToken = zoomHelpers.getZoomAccessToken;
      const createZoomMeeting = zoomHelpers.createZoomMeeting;
      
      const topic = `Counselling Session - ${counsellorProfile?.name || 'Counsellor'}`;
      const meetingDateTime = getDateTime(date, start_time);
      const startTimeISO = meetingDateTime.toISOString();
      
      const start = new Date(`2000-01-01T${start_time}`);
      const end = new Date(`2000-01-01T${end_time}`);
      const duration = Math.round((end - start) / 60000);

      const accessToken = await getZoomAccessToken();
      const zoomData = await createZoomMeeting(accessToken, topic, startTimeISO, duration);

      const { data: zoomMeetingData, error: zoomError } = await supabase
        .from('zoom_meetings')
        .insert({
          appointment_id: appointment.id,
          meeting_number: zoomData.meeting_number,
          meeting_password: zoomData.meeting_password,
          start_url: zoomData.start_url,
          join_url: zoomData.join_url
        })
        .select()
        .single();

      if (!zoomError) {
        zoomMeeting = zoomMeetingData;
      }
    } catch (zoomErr) {
      console.error('Error creating Zoom meeting:', zoomErr);
    }

    // Send confirmation email to student
    if (student && student.email) {
      await sendAppointmentEmail(
        student.email,
        counsellorProfile?.name || 'Counsellor',
        date,
        start_time,
        end_time,
        zoomMeeting?.join_url || null
      );
    }

    // Send email to counsellor if email available
    if (counsellorProfile?.gmail) {
      const counsellorMailOptions = {
        from: emailFrom,
        to: counsellorProfile.gmail,
        subject: 'New Counselling Appointment',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>New Appointment Scheduled</h2>
            <p>You have a new counselling appointment scheduled.</p>
            <div style="background: #f5f7fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${start_time} - ${end_time}</p>
              ${zoomMeeting?.join_url ? `<p><strong>Meeting Link:</strong> <a href="${zoomMeeting.join_url}">Join Meeting</a></p>` : ''}
            </div>
          </div>
        `
      };
      await sendEmail(counsellorMailOptions).catch(console.error);
    }

    res.json({ 
      appointment: {
        ...appointment,
        zoomMeeting: zoomMeeting || null
      }
    });
  } catch (error) {
    console.error('Book appointment (day order) error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// PRE-SESSION BRIEF  (counsellor only)
// GET /api/appointments/pre-session-brief/student/:studentId
// Returns a 3-sentence AI summary of the student's recent bot conversations.
// ─────────────────────────────────────────────
router.get('/pre-session-brief/student/:studentId', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Only counsellors can view pre-session briefs' });
    }

    const { studentId } = req.params;

    // 1. Verify this counsellor has (or had) an appointment with this student
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('id')
      .eq('student_id', studentId)
      .eq('counsellor_id', req.user.userId)
      .limit(1);

    if (apptError || !appointment || appointment.length === 0) {
      return res.status(403).json({ error: 'Not authorized to view this student\'s records.' });
    }

    // 2. Fetch recent chat messages from the sessions table
    const { data: sessionData, error: msgError } = await supabase
      .from('sessions')
      .select('messages')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let recentMessages = [];
    if (sessionData && Array.isArray(sessionData.messages)) {
      recentMessages = sessionData.messages
        .filter(m => m.role === 'user')
        .slice(-30); // get up to 30 recent user messages
    } else if (msgError && msgError.code !== 'PGRST116') {
      console.error('sessions fetch error:', msgError);
    }

    // 3. Also fetch mood data as supplementary context
    const { data: moods } = await supabase
      .from('mood_tracking')
      .select('date, mood, stress_level, notes')
      .eq('user_id', studentId)
      .order('date', { ascending: false })
      .limit(7);

    // 4. If no chat messages, generate brief from mood data only
    let brief = null;

    if (recentMessages.length === 0 && (!moods || moods.length === 0)) {
      return res.json({
        brief: 'No bot conversations or mood check-ins available for this student yet. Consider asking them to use the AI Counselling chat before their session.',
        generatedAt: new Date().toISOString(),
        messageCount: 0,
      });
    }

    // 5. Build context string for the AI
    let contextText = '';
    if (recentMessages.length > 0) {
      const msgText = recentMessages
        .slice(0, 20)
        .reverse()
        .map(m => `Student: ${m.content}`)
        .join('\n');
      contextText += `--- Recent Bot Conversation Messages ---\n${msgText}\n`;
    }
    if (moods && moods.length > 0) {
      const moodText = moods
        .map(m => `Date: ${m.date}, Mood: ${m.mood}/10, Stress: ${m.stress_level || '?'}/10${m.notes ? `, Notes: "${m.notes}"` : ''}`)
        .join('\n');
      contextText += `\n--- Recent Mood Check-ins ---\n${moodText}`;
    }

    // 6. Generate brief using Groq
    const Groq = require('groq-sdk');
    if (!process.env.GROQ_API_KEY) {
      return res.json({
        brief: 'AI summary unavailable (GROQ_API_KEY not configured). Based on available data, please review the student\'s mood trends and conversation history manually.',
        generatedAt: new Date().toISOString(),
        messageCount: recentMessages.length,
        fallback: true,
      });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'];

    const prompt = `Summarize the student's main concerns, emotional state, and any recurring themes from these messages in EXACTLY 3 sentences for a counselor preparing for a session. Be clinical and neutral in tone.\n\n${contextText}`;

    for (const model of GROQ_MODELS) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are a clinical preparation assistant. Write exactly 3 sentences. Be objective and concise.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 250,
        });
        brief = completion.choices[0].message.content.trim();
        break;
      } catch (err) {
        // Try next model silently
      }
    }

    if (!brief) {
      // Fallback
      brief = `The student has had ${recentMessages.length} recent AI chat interactions with themes related to their mood check-ins. Please review their recent messages and mood data for a full clinical picture before the session.`;
    }

    return res.json({
      brief,
      generatedAt: new Date().toISOString(),
      messageCount: recentMessages.length,
      moodEntryCount: moods?.length || 0,
    });
  } catch (error) {
    console.error('Pre-session brief error:', error);
    res.status(500).json({ error: 'Failed to generate pre-session brief' });
  }
});

// ────────────────────────────────────────────────────────────────
// QUESTIONNAIRE ENDPOINTS
// ────────────────────────────────────────────────────────────────

// Submit a PHQ-9 form
router.post('/phq9', verifyToken, async (req, res) => {
  try {
    const { appointmentId, responses, totalScore } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!appointmentId || !responses) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    const { data, error } = await supabase
      .from('questionnaire_responses')
      .insert({
        user_id: userId,
        appointment_id: appointmentId,
        type: 'PHQ-9',
        responses,
        total_score: totalScore
      });

    if (error) {
      console.error('Insert PHQ9 error:', error);
      return res.status(500).json({ error: 'Failed to save questionnaire' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('PHQ9 endpoint error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch all PHQ-9 data for a specific student
router.get('/student-phq9/:studentId', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Optional Check: Is the caller a counsellor who has an appointment with them?
    if (req.user.userType !== 'counsellor' && req.user.userType !== 'admin') {
      if (req.user.userId !== studentId && req.user.id !== studentId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { data: qData, error } = await supabase
      .from('questionnaire_responses')
      .select('created_at, total_score, appointment_id')
      .eq('user_id', studentId)
      .eq('type', 'PHQ-9')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch PHQ9 error:', error);
      return res.json({ scores: [] });
    }

    res.json({ scores: qData || [] });
  } catch (err) {
    console.error('PHQ9 fetch error:', err);
    res.json({ scores: [] });
  }
});

module.exports = router;

