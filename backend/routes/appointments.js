const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./auth');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { buildFollowUpSchedule } = require('../services/followUpService');
const { getDateTime, formatDateTimeForLog, normalizeTime } = require('../utils/dateTimeHelper');
const { sendEmail, emailFrom } = require('../services/emailService');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isSupabaseFetchFailure = (error) => {
  const details = `${error?.message || ''} ${error?.details || ''} ${error?.cause?.message || ''}`;
  return details.includes('fetch failed') || details.includes('UND_ERR_CONNECT_TIMEOUT') || details.includes('Connect Timeout');
};

async function runSupabaseQuery(queryFactory, attempts = 2) {
  let lastResult;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = await queryFactory();

    if (!lastResult?.error || !isSupabaseFetchFailure(lastResult.error) || attempt === attempts) {
      return lastResult;
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }

  return lastResult;
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

    // 🔒 Check if counsellor is marked unavailable
    const { data: counsellorStatusCheck, error: counsellorStatusError } = await supabase
      .from('counsellor_profiles')
      .select('is_available, available_until')
      .eq('user_id', counsellorId)
      .single();

    if (counsellorStatusError && counsellorStatusError.code !== 'PGRST116') {
      throw counsellorStatusError;
    }

    if (counsellorStatusCheck && counsellorStatusCheck.is_available === false) {
      return res.status(409).json({ error: 'This counsellor is currently unavailable for booking' });
    }

    if (counsellorStatusCheck && counsellorStatusCheck.available_until) {
      const now = new Date();
      const availableUntil = new Date(counsellorStatusCheck.available_until);
      const appointmentDate = new Date(`${date}T${startTime}`);
      
      if (availableUntil > now && availableUntil > appointmentDate) {
        return res.status(409).json({ error: 'This counsellor is unavailable during that time period' });
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

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Appointment booked:', { 
      id: appointment?.id, 
      date, 
      startTime, 
      endTime,
      startDateTime: getDateTime(date, startTime).toISOString(),
      endDateTime: getDateTime(date, endTime).toISOString()
    });

    // Automatically allocate counsellor to student if not already assigned
    try {
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('assigned_counsellor_id')
        .eq('user_id', req.user.userId)
        .maybeSingle();

      if (profile) {
        await supabase
          .from('student_profiles')
          .update({ assigned_counsellor_id: counsellorId, updated_at: new Date().toISOString() })
          .eq('user_id', req.user.userId);
        console.log(`[Allocation] Assigned counsellor ${counsellorId} to student ${req.user.userId}`);
      }
    } catch (allocErr) {
      console.error('Error auto-assigning counsellor on booking:', allocErr);
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

// Get per-student session counts for a counsellor (all statuses) - ONLY for allocated students
router.get('/counsellor/session-stats', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Only counsellors can view session stats' });
    }

    const counsellorId = req.user.userId;

    const { data: assignedProfiles, error: profileError } = await supabase
      .from('student_profiles')
      .select('user_id, name, year, course, department')
      .eq('assigned_counsellor_id', counsellorId);

    if (profileError) {
      console.error('Session stats profile fetch error:', profileError);
      return res.status(500).json({ error: profileError.message });
    }

    const { data: appointmentRows, error: apptListError } = await supabase
      .from('appointments')
      .select('student_id')
      .eq('counsellor_id', counsellorId);

    if (apptListError) {
      console.error('Session stats appointments list error:', apptListError);
      return res.status(500).json({ error: apptListError.message });
    }

    const bookedStudentIds = [...new Set((appointmentRows || []).map((r) => r.student_id).filter(Boolean))];

    let profiles = assignedProfiles || [];
    if (bookedStudentIds.length > 0) {
      const assignedIds = new Set(profiles.map((p) => p.user_id));
      const missingIds = bookedStudentIds.filter((id) => !assignedIds.has(id));
      if (missingIds.length > 0) {
        const { data: extraProfiles } = await supabase
          .from('student_profiles')
          .select('user_id, name, year, course, department')
          .in('user_id', missingIds);
        profiles = [...profiles, ...(extraProfiles || [])];
      }
    }

    if (!profiles || profiles.length === 0) {
      return res.json({ stats: [] });
    }

    const studentIds = profiles.map(p => p.user_id);

    // Fetch all appointments for these students with this counsellor
    const { data: rows, error: apptError } = await supabase
      .from('appointments')
      .select('student_id, status')
      .eq('counsellor_id', counsellorId)
      .in('student_id', studentIds);

    if (apptError) {
      console.error('Session stats appointments fetch error:', apptError);
      return res.status(500).json({ error: apptError.message });
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

    const stats = profiles.map((p) => {
      const counts = countsMap.get(p.user_id) || { completed: 0, scheduled: 0, cancelled: 0 };
      return {
        studentId: p.user_id,
        name: p.name || 'Unknown Student',
        year: p.year || null,
        course: p.course || null,
        department: p.department || null,
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

    // Student profile (including gender and contact_info)
    const { data: profile, error: profileError } = await supabase
      .from('student_profiles')
      .select('user_id, name, year, course, department, gender, contact_info, reg_number, section, assigned_counsellor_id')
      .eq('user_id', studentId)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Student profile not found' });
      }
      throw profileError;
    }

    // Fetch student email from users table
    const { data: userRecord } = await supabase
      .from('users')
      .select('email')
      .eq('id', studentId)
      .single();

    // Ensure relationship / get full session history
    const { data: appts, error: apptError } = await supabase
      .from('appointments')
      .select('id, date, start_time, end_time, status, notes, created_at')
      .eq('counsellor_id', counsellorId)
      .eq('student_id', studentId)
      .order('date', { ascending: false });

    if (apptError) throw apptError;

    const hasSessionsWithCounsellor = (appts || []).length > 0;
    const isAssignedCounsellor = profile.assigned_counsellor_id === counsellorId;

    if (!isAssignedCounsellor && !hasSessionsWithCounsellor) {
      return res.status(403).json({ error: 'Not authorized to view this student\'s records.' });
    }

    const sessionCounts = { completed: 0, scheduled: 0, cancelled: 0 };
    (appts || []).forEach((a) => {
      if (a.status === 'completed') sessionCounts.completed += 1;
      else if (a.status === 'cancelled') sessionCounts.cancelled += 1;
      else sessionCounts.scheduled += 1;
    });

    // Recent mood entries (daily check-ins)
    const { data: moods, error: moodError } = await supabase
      .from('mood_tracking')
      .select('date, mood, emoji, notes, stress_level, sleep_hours')
      .eq('user_id', studentId)
      .order('date', { ascending: false })
      .limit(30);

    if (moodError) throw moodError;

    res.json({
      student: {
        ...profile,
        email: userRecord?.email || null,
      },
      sessions: sessionCounts,
      sessionHistory: appts || [],
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
        // First try to get student profile (no email column here)
        let { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('name, year, department, course')
          .eq('user_id', appt.student_id)
          .single();

        // If no profile or to enrich profile, get basic user email from users table
        const { data: userData } = await supabase
          .from('users')
          .select('email')
          .eq('id', appt.student_id)
          .single();

        if (studentProfile) {
          studentProfile.email = userData?.email || '';
        } else {
          studentProfile = {
            name: userData?.email?.split('@')[0] || 'Unknown Student',
            email: userData?.email || '',
            year: null,
            department: null,
            course: null
          };
        }

        return {
          ...appt,
          student: {
            user_id: appt.student_id,
            name: studentProfile.name,
            email: studentProfile.email,
            year: studentProfile.year,
            department: studentProfile.department,
            course: studentProfile.course
          }
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

    const { data: report, error } = await runSupabaseQuery(() => supabase
      .from('progress_reports')
      .select('*')
      .eq('id', reportId)
      .eq('counsellor_id', counsellorId)
      .single());

    console.log('Report data:', report, 'Error:', error);
    if (error) {
      console.error('Progress report PDF fetch error:', error);
      if (isSupabaseFetchFailure(error)) {
        return res.status(503).json({
          error: 'Unable to reach the database while generating the PDF. Please retry in a moment.'
        });
      }
      return res.status(500).json({ error: error.message });
    }
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // ─── PDF Setup ──────────────────────────────────────────────
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      info: {
        Title: 'Weekly Counseling Progress Report',
        Author: report.counsellor_name || 'Counsellor',
        Subject: `Progress Report – ${report.student_name}`,
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=progress-report-${(report.student_name || 'student').replace(/\s+/g, '-')}-${report.week_start}.pdf`);
    doc.pipe(res);

    // ─── Constants ───────────────────────────────────────────────
    const LEFT   = 50;
    const RIGHT  = 545;
    const WIDTH  = RIGHT - LEFT;
    const PRIMARY   = '#1a3a5c';   // dark navy
    const ACCENT    = '#2ec4b6';   // teal
    const LIGHT_BG  = '#f0f7ff';   // section bg
    const GREY_TEXT = '#555555';
    const RULE_CLR  = '#ccd8e8';

    // ─── Helper: draw a thick section header bar ─────────────────
    const sectionHeader = (title, yOverride) => {
      const y = yOverride !== undefined ? yOverride : doc.y;
      // Ensure we don't overflow page
      if (y + 28 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        return sectionHeader(title, doc.y);
      }
      doc.rect(LEFT, y, WIDTH, 22).fill(PRIMARY);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
         .text(title, LEFT + 8, y + 6, { width: WIDTH - 16 });
      doc.fillColor('#000000');
      doc.y = y + 28;
      return doc.y;
    };

    // ─── Helper: ensure space, add page if needed ────────────────
    const ensureSpace = (needed) => {
      if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
    };

    // ─── Helper: horizontal rule ─────────────────────────────────
    const hRule = (color = RULE_CLR, thickness = 0.5) => {
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y)
         .lineWidth(thickness).strokeColor(color).stroke();
      doc.y += 4;
    };

    // ─── Helper: draw table row ───────────────────────────────────
    const tableRow = (cols, y, heights, shade) => {
      const rowH = Math.max(...heights, 18);
      if (shade) {
        doc.rect(LEFT, y, WIDTH, rowH).fill('#f5f9fc');
        doc.fillColor('#000000');
      }
      let x = LEFT;
      cols.forEach((col, i) => {
        doc.rect(x, y, col.w, rowH).lineWidth(0.4).strokeColor(RULE_CLR).stroke();
        doc.fillColor(col.bold ? PRIMARY : '#222222')
           .font(col.bold ? 'Helvetica-Bold' : 'Helvetica')
           .fontSize(col.fontSize || 9)
           .text(col.text || '', x + 5, y + 4, { width: col.w - 10, lineBreak: true });
        x += col.w;
      });
      return rowH;
    };

    // ─── PAGE HEADER ─────────────────────────────────────────────
    // Top accent bar
    doc.rect(LEFT, 30, WIDTH, 4).fill(ACCENT);
    doc.y = 44;

    // Institution / Report title
    doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(16)
       .text('Weekly Counseling Progress Report', LEFT, doc.y, { align: 'center', width: WIDTH });
    doc.y += 4;
    doc.fillColor(GREY_TEXT).font('Helvetica').fontSize(10)
       .text('Student Academic & Wellbeing Monitoring', LEFT, doc.y, { align: 'center', width: WIDTH });
    doc.y += 6;
    doc.rect(LEFT, doc.y, WIDTH, 1).fill(ACCENT);
    doc.y += 10;

    // ─── STUDENT INFORMATION ─────────────────────────────────────
    sectionHeader('STUDENT INFORMATION');

    // Light bg box
    const infoBoxY = doc.y;
    doc.rect(LEFT, infoBoxY, WIDTH, 72).fill(LIGHT_BG).stroke();
    doc.fillColor('#000000');

    const colWidth = WIDTH / 3;
    const col1 = LEFT + 8;
    const col2 = LEFT + colWidth + 8;
    const col3 = LEFT + 2 * colWidth + 8;

    // Row 1
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GREY_TEXT)
       .text('STUDENT NAME', col1, infoBoxY + 8)
       .text('REGISTER NUMBER', col2, infoBoxY + 8)
       .text('DEPARTMENT / YEAR', col3, infoBoxY + 8);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(PRIMARY)
       .text(report.student_name || '—', col1, infoBoxY + 19, { width: colWidth - 16 })
       .text(report.register_number || '—', col2, infoBoxY + 19, { width: colWidth - 16 })
       .text(report.department_year || '—', col3, infoBoxY + 19, { width: colWidth - 16 });

    // Row 2
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GREY_TEXT)
       .text('WEEK START', col1, infoBoxY + 44)
       .text('WEEK END', col2, infoBoxY + 44)
       .text('COUNSELLOR', col3, infoBoxY + 44);

    doc.font('Helvetica').fontSize(10).fillColor('#000000')
       .text(report.week_start || '—', col1, infoBoxY + 55, { width: colWidth - 16 })
       .text(report.week_end   || '—', col2, infoBoxY + 55, { width: colWidth - 16 })
       .text(report.counsellor_name || '—', col3, infoBoxY + 55, { width: colWidth - 16 });

    doc.y = infoBoxY + 80;

    // ─── 1. ACADEMIC PERFORMANCE ──────────────────────────────────
    ensureSpace(80);
    sectionHeader('1. ACADEMIC PERFORMANCE');

    const apCols = [
      { label: 'Subject', w: 165 },
      { label: 'Score (%)', w: 80 },
      { label: 'Attendance (%)', w: 90 },
      { label: 'Remarks', w: 160 },
    ];

    // Header row
    let rowY = doc.y;
    let x = LEFT;
    apCols.forEach(c => {
      doc.rect(x, rowY, c.w, 20).fill(ACCENT).stroke();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
         .text(c.label, x + 5, rowY + 5, { width: c.w - 10 });
      x += c.w;
    });
    doc.fillColor('#000000');
    rowY += 20;

    const apData = Array.isArray(report.academic_performance) ? report.academic_performance : [];
    const apRows = apData.length > 0 ? apData : [{ subject: '', score: '', attendance: '', remarks: '' }];

    apRows.forEach((sub, i) => {
      ensureSpace(22);
      const heights = apCols.map((c, ci) => {
        const texts = [sub.subject || '', sub.score || '', sub.attendance || '', sub.remarks || ''];
        return doc.heightOfString(texts[ci] || '', { width: c.w - 10, fontSize: 9 }) + 10;
      });
      const rH = tableRow([
        { text: sub.subject || '', w: 165 },
        { text: sub.score ? `${sub.score}%` : '', w: 80 },
        { text: sub.attendance ? `${sub.attendance}%` : '', w: 90 },
        { text: sub.remarks || '', w: 160 },
      ], rowY, heights, i % 2 === 0);
      rowY += rH;
    });
    doc.y = rowY + 6;

    // ─── 2. REVIEW OF PREVIOUS WEEK'S GOALS ───────────────────────
    ensureSpace(80);
    sectionHeader("2. REVIEW OF THE PREVIOUS WEEK'S GOALS");

    const goalCols = [
      { label: 'Goal / Target', w: 195 },
      { label: 'Status', w: 90 },
      { label: 'Reason / Notes', w: 210 },
    ];

    rowY = doc.y;
    x = LEFT;
    goalCols.forEach(c => {
      doc.rect(x, rowY, c.w, 20).fill(ACCENT).stroke();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
         .text(c.label, x + 5, rowY + 5, { width: c.w - 10 });
      x += c.w;
    });
    doc.fillColor('#000000');
    rowY += 20;

    const goalData = Array.isArray(report.previous_goals_review) ? report.previous_goals_review : [];
    const goalRows = goalData.length > 0 ? goalData : [{ goal: '', status: '', reason: '' }];

    goalRows.forEach((g, i) => {
      ensureSpace(26);
      const heights = [
        doc.heightOfString(g.goal || '', { width: 185, fontSize: 9 }) + 10,
        doc.heightOfString(g.status || '', { width: 80, fontSize: 9 }) + 10,
        doc.heightOfString(g.reason || '', { width: 200, fontSize: 9 }) + 10,
      ];
      const rH = tableRow([
        { text: g.goal || '', w: 195 },
        { text: g.status || '', w: 90 },
        { text: g.reason || '', w: 210 },
      ], rowY, heights, i % 2 === 0);
      rowY += rH;
    });
    doc.y = rowY + 6;

    // ─── 3. ISSUES / CHALLENGES ───────────────────────────────────
    ensureSpace(120);
    sectionHeader('3. ISSUES / CHALLENGES FACED THIS WEEK');

    const issues = Array.isArray(report.issues_challenges) ? report.issues_challenges : [];
    const issueOptions = [
      'Lack of conceptual clarity in subjects',
      'Poor time management',
      'Low attendance/absenteeism',
      'Lack of motivation/confidence',
      'Distractions (social media, gaming, etc.)',
      'Personal / family issues',
      'Health issues'
    ];

    // Two-column layout for issues
    const issLeft  = issueOptions.filter((_, i) => i % 2 === 0);
    const issRight = issueOptions.filter((_, i) => i % 2 === 1);
    const maxRows  = Math.max(issLeft.length, issRight.length);
    const issBoxY  = doc.y;

    doc.rect(LEFT, issBoxY, WIDTH, maxRows * 18 + 12).fill(LIGHT_BG);
    doc.fillColor('#000000');

    for (let r = 0; r < maxRows; r++) {
      const y = issBoxY + 6 + r * 18;
      const lIss = issLeft[r];
      const rIss = issRight[r];
      if (lIss) {
        const checked = issues.includes(lIss);
        doc.rect(LEFT + 8, y + 2, 10, 10)
           .lineWidth(0.8).strokeColor(PRIMARY).stroke();
        if (checked) {
          doc.fillColor(ACCENT)
             .font('Helvetica-Bold').fontSize(10)
             .text('✓', LEFT + 9, y + 1);
          doc.fillColor('#000000');
        }
        doc.font(checked ? 'Helvetica-Bold' : 'Helvetica')
           .fontSize(9).fillColor(checked ? PRIMARY : '#444444')
           .text(lIss, LEFT + 24, y + 2, { width: 230 });
      }
      if (rIss) {
        const checked = issues.includes(rIss);
        doc.rect(LEFT + 8 + 270, y + 2, 10, 10)
           .lineWidth(0.8).strokeColor(PRIMARY).stroke();
        if (checked) {
          doc.fillColor(ACCENT)
             .font('Helvetica-Bold').fontSize(10)
             .text('✓', LEFT + 8 + 271, y + 1);
          doc.fillColor('#000000');
        }
        doc.font(checked ? 'Helvetica-Bold' : 'Helvetica')
           .fontSize(9).fillColor(checked ? PRIMARY : '#444444')
           .text(rIss, LEFT + 24 + 270, y + 2, { width: 240 });
      }
    }
    doc.y = issBoxY + maxRows * 18 + 16;

    if (report.other_issues) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GREY_TEXT).text('Other Issues:', LEFT, doc.y);
      doc.font('Helvetica').fontSize(9).fillColor('#000000')
         .text(report.other_issues, LEFT + 72, doc.y - 11, { width: WIDTH - 72 });
    }
    doc.y += 8;

    // ─── 4. COUNSELING & SUPPORT PROVIDED ────────────────────────
    ensureSpace(100);
    sectionHeader('4. COUNSELING & SUPPORT PROVIDED');

    const support = report.counseling_support || {};
    const supportItems = [
      { label: 'Academic Guidance', value: support.academic_guidance },
      { label: 'Study Strategy Suggestions', value: support.study_strategy },
      { label: 'Motivational Support', value: support.motivational_support },
      { label: 'Peer Study Group / Mentorship', value: support.peer_study },
      { label: 'Parent Communication', value: support.parent_communication },
    ];

    supportItems.forEach((item, i) => {
      ensureSpace(24);
      const y = doc.y;
      if (i % 2 === 0) doc.rect(LEFT, y, WIDTH, 22).fill(LIGHT_BG);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GREY_TEXT)
         .text(`• ${item.label}:`, LEFT + 8, y + 6, { continued: true })
         .font('Helvetica').fillColor('#111111')
         .text(`  ${item.value || '—'}`, { width: WIDTH - 90 });
      doc.y = y + 22;
    });
    doc.y += 6;

    // ─── 5. PLAN & TARGETS FOR NEXT WEEK ─────────────────────────
    ensureSpace(80);
    sectionHeader('5. PLAN & TARGETS FOR NEXT WEEK');

    const planCols = [
      { label: 'Goal / Target', w: 165 },
      { label: 'Steps to Achieve', w: 180 },
      { label: 'Responsible', w: 150 },
    ];

    rowY = doc.y;
    x = LEFT;
    planCols.forEach(c => {
      doc.rect(x, rowY, c.w, 20).fill(ACCENT).stroke();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
         .text(c.label, x + 5, rowY + 5, { width: c.w - 10 });
      x += c.w;
    });
    doc.fillColor('#000000');
    rowY += 20;

    const planData = Array.isArray(report.next_week_plan) ? report.next_week_plan : [];
    const planRows = planData.length > 0 ? planData : [{ goal: '', steps: '', responsible: '' }];

    planRows.forEach((plan, i) => {
      ensureSpace(26);
      const heights = [
        doc.heightOfString(plan.goal || '', { width: 155, fontSize: 9 }) + 10,
        doc.heightOfString(plan.steps || '', { width: 170, fontSize: 9 }) + 10,
        doc.heightOfString(plan.responsible || '', { width: 140, fontSize: 9 }) + 10,
      ];
      const rH = tableRow([
        { text: plan.goal || '', w: 165 },
        { text: plan.steps || '', w: 180 },
        { text: plan.responsible || '', w: 150 },
      ], rowY, heights, i % 2 === 0);
      rowY += rH;
    });
    doc.y = rowY + 6;

    // ─── 6. COUNSELLOR'S REMARKS ──────────────────────────────────
    ensureSpace(80);
    sectionHeader("6. COUNSELLOR'S REMARKS & OBSERVATIONS");

    const remarks = report.counsellor_remarks || '';
    const remarksH = Math.max(doc.heightOfString(remarks || ' ', { width: WIDTH - 16, fontSize: 10 }) + 20, 60);
    ensureSpace(remarksH + 10);
    doc.rect(LEFT, doc.y, WIDTH, remarksH).fill(LIGHT_BG).lineWidth(0.5).strokeColor(RULE_CLR).stroke();
    doc.fillColor('#000000').font('Helvetica').fontSize(10)
       .text(remarks || 'No remarks recorded.', LEFT + 8, doc.y + 8, { width: WIDTH - 16 });
    doc.y += remarksH + 8;

    // ─── 7. STUDENT'S COMMITMENT ──────────────────────────────────
    ensureSpace(80);
    sectionHeader("7. STUDENT'S COMMITMENT");

    const commitY = doc.y;
    doc.rect(LEFT, commitY, WIDTH, 60).fill(LIGHT_BG).stroke();

    const commitChecked = report.student_commitment;
    doc.rect(LEFT + 10, commitY + 10, 14, 14).lineWidth(1).strokeColor(PRIMARY).stroke();
    if (commitChecked) {
      doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(13)
         .text('✓', LEFT + 12, commitY + 9);
    }
    doc.fillColor('#000000').font('Helvetica').fontSize(9)
       .text('"I will follow the agreed plan and take responsibility for my learning."',
             LEFT + 30, commitY + 12, { width: WIDTH - 40 });

    // Signature row
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GREY_TEXT)
       .text('STUDENT SIGNATURE', LEFT + 10, commitY + 36)
       .text('DATE', LEFT + 300, commitY + 36);
    doc.font('Helvetica').fontSize(9).fillColor('#000000')
       .text(report.student_signature || '________________________', LEFT + 10, commitY + 46)
       .text(report.student_signature_date || '________________', LEFT + 300, commitY + 46);

    doc.y = commitY + 68;

    // ─── 8. COUNSELLOR'S SIGNATURE ────────────────────────────────
    ensureSpace(70);
    sectionHeader("8. COUNSELLOR'S SIGNATURE & CERTIFICATION");

    const sigY = doc.y;
    doc.rect(LEFT, sigY, WIDTH, 55).fill(LIGHT_BG).stroke();

    doc.font('Helvetica').fontSize(9).fillColor(GREY_TEXT)
       .text('I certify that this report is an accurate record of the counselling provided.', LEFT + 10, sigY + 8, { width: WIDTH - 20 });

    doc.font('Helvetica-Bold').fontSize(8).fillColor(GREY_TEXT)
       .text('COUNSELLOR NAME & SIGNATURE', LEFT + 10, sigY + 28)
       .text('DATE', LEFT + 340, sigY + 28);
    doc.font('Helvetica').fontSize(9).fillColor('#000000')
       .text(report.counsellor_signature || '________________________', LEFT + 10, sigY + 39)
       .text(report.counsellor_signature_date || '________________', LEFT + 340, sigY + 39);

    doc.y = sigY + 63;

    // ─── FOOTER on each page ──────────────────────────────────────
    const totalPages = doc.bufferedPageRange ? doc.bufferedPageRange().count : 1;
    for (let i = 0; i < doc._pageBuffer?.length || 0; i++) {
      // pdfkit doesn't easily support page numbers mid-stream; add bottom bar
    }

    // Bottom accent bar on last page
    const bottomY = doc.page.height - 45;
    doc.rect(LEFT, bottomY, WIDTH, 2).fill(ACCENT);
    doc.fillColor(GREY_TEXT).font('Helvetica').fontSize(8)
       .text(
         `Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}   |   Confidential — For Counselling Use Only`,
         LEFT, bottomY + 6, { align: 'center', width: WIDTH }
       );

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

    // 🔒 Check if counsellor is marked unavailable
    const { data: counsellorAvailCheck, error: counsellorAvailError } = await supabase
      .from('counsellor_profiles')
      .select('is_available, available_until')
      .eq('user_id', counsellorId)
      .single();

    if (counsellorAvailError && counsellorAvailError.code !== 'PGRST116') {
      throw counsellorAvailError;
    }

    if (counsellorAvailCheck && counsellorAvailCheck.is_available === false) {
      return res.status(409).json({ error: 'This counsellor is currently unavailable for booking' });
    }

    if (counsellorAvailCheck && counsellorAvailCheck.available_until) {
      const now = new Date();
      const availableUntil = new Date(counsellorAvailCheck.available_until);
      const appointmentDate = new Date(`${date}T${start_time}`);
      
      if (availableUntil > now && availableUntil > appointmentDate) {
        return res.status(409).json({ error: 'This counsellor is unavailable during that time period' });
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

    // Assign booked counsellor so they receive questionnaires and clinical access
    try {
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('user_id')
        .eq('user_id', req.user.userId)
        .maybeSingle();

      if (profile) {
        await supabase
          .from('student_profiles')
          .update({ assigned_counsellor_id: counsellorId, updated_at: new Date().toISOString() })
          .eq('user_id', req.user.userId);
        console.log(`[Allocation] Assigned counsellor ${counsellorId} to student ${req.user.userId} (day-order booking)`);
      }
    } catch (allocErr) {
      console.error('Error assigning counsellor on day-order booking:', allocErr);
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

// Submit a PHQ-9 form (linked to the appointment the student booked)
router.post('/phq9', verifyToken, async (req, res) => {
  try {
    const { appointmentId, responses, totalScore } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!appointmentId || !responses) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    if (!Array.isArray(responses) || responses.length !== 9 || responses.some((r) => r === null || r === undefined)) {
      return res.status(400).json({ error: 'All 9 PHQ-9 questions must be answered' });
    }

    const { data: appointment, error: aptError } = await supabase
      .from('appointments')
      .select('id, student_id, counsellor_id')
      .eq('id', appointmentId)
      .single();

    if (aptError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.student_id !== userId) {
      return res.status(403).json({ error: 'You can only submit a questionnaire for your own appointment' });
    }

    const { data: existing } = await supabase
      .from('questionnaire_responses')
      .select('id')
      .eq('appointment_id', appointmentId)
      .eq('type', 'PHQ-9')
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Questionnaire already submitted for this appointment' });
    }

    const computedScore = responses.reduce((sum, val) => sum + Number(val), 0);
    const scoreToSave = typeof totalScore === 'number' ? totalScore : computedScore;

    const { error } = await supabase
      .from('questionnaire_responses')
      .insert({
        user_id: userId,
        appointment_id: appointmentId,
        type: 'PHQ-9',
        responses,
        total_score: scoreToSave
      });

    if (error) {
      console.error('Insert PHQ9 error:', error);
      return res.status(500).json({ error: 'Failed to save questionnaire' });
    }

    console.log(`[PHQ-9] Saved for appointment ${appointmentId} → counsellor ${appointment.counsellor_id}`);
    res.json({ success: true, counsellorId: appointment.counsellor_id });
  } catch (err) {
    console.error('PHQ9 endpoint error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch PHQ-9 data for a student (counsellors only see responses for their booked sessions)
router.get('/student-phq9/:studentId', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const callerId = req.user.userId || req.user.id;
    const isCounsellor = req.user.userType === 'counsellor';
    const isAdmin = req.user.userType === 'admin';

    if (!isCounsellor && !isAdmin) {
      if (callerId !== studentId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    if (isCounsellor) {
      const { data: relationship } = await supabase
        .from('appointments')
        .select('id')
        .eq('counsellor_id', callerId)
        .eq('student_id', studentId)
        .limit(1);

      const { data: profile } = await supabase
        .from('student_profiles')
        .select('assigned_counsellor_id')
        .eq('user_id', studentId)
        .maybeSingle();

      const hasAccess =
        (relationship && relationship.length > 0) ||
        profile?.assigned_counsellor_id === callerId;

      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to view this student\'s questionnaires' });
      }
    }

    const { data: qData, error } = await supabase
      .from('questionnaire_responses')
      .select('id, created_at, total_score, responses, appointment_id')
      .eq('user_id', studentId)
      .eq('type', 'PHQ-9')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch PHQ9 error:', error);
      return res.json({ scores: [] });
    }

    let scores = qData || [];

    if (isCounsellor) {
      const appointmentIds = scores.map((s) => s.appointment_id).filter(Boolean);
      if (appointmentIds.length === 0) {
        return res.json({ scores: [] });
      }

      const { data: appts } = await supabase
        .from('appointments')
        .select('id, date, start_time, counsellor_id')
        .in('id', appointmentIds)
        .eq('counsellor_id', callerId);

      const apptMap = new Map((appts || []).map((a) => [a.id, a]));

      scores = scores
        .filter((s) => apptMap.has(s.appointment_id))
        .map((s) => {
          const apt = apptMap.get(s.appointment_id);
          return {
            ...s,
            appointment_date: apt?.date || null,
            appointment_start_time: apt?.start_time || null
          };
        });
    } else if (scores.length > 0) {
      const appointmentIds = scores.map((s) => s.appointment_id).filter(Boolean);
      const { data: appts } = await supabase
        .from('appointments')
        .select('id, date, start_time')
        .in('id', appointmentIds);
      const apptMap = new Map((appts || []).map((a) => [a.id, a]));
      scores = scores.map((s) => {
        const apt = apptMap.get(s.appointment_id);
        return {
          ...s,
          appointment_date: apt?.date || null,
          appointment_start_time: apt?.start_time || null
        };
      });
    }

    res.json({ scores });
  } catch (err) {
    console.error('PHQ9 fetch error:', err);
    res.json({ scores: [] });
  }
});

module.exports = router;

