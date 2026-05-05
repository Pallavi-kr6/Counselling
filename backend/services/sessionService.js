const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const axios = require('axios');
const { getDateTime } = require('../utils/dateTimeHelper');

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

const ACTIVE_SESSION_STATUSES = ['scheduled', 'confirmed', 'pending_reassign', 'reassigned'];

function uniqueIds(ids = []) {
  return [...new Set((ids || []).filter(Boolean))];
}

function overlaps(startA, endA, startB, endB) {
  const normalize = (value) => String(value).slice(0, 5);
  return normalize(startA) < normalize(endB) && normalize(endA) > normalize(startB);
}

function formatTimeHHMM(value) {
  return value ? String(value).slice(0, 5) : null;
}

function timeToMinutes(value) {
  const [hours, minutes] = formatTimeHHMM(value).split(':').map(Number);
  return hours * 60 + minutes;
}

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const [year, month, day] = toDateOnly(dateString).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function formatScheduleForMessage(sessionOrCandidate) {
  const dayOrder = sessionOrCandidate.day_order_name
    ? ` (${sessionOrCandidate.day_order_name})`
    : '';
  return `${toDateOnly(sessionOrCandidate.date)}${dayOrder}, ${formatTimeHHMM(sessionOrCandidate.start_time)} - ${formatTimeHHMM(sessionOrCandidate.end_time)}`;
}

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
  if (!mailOptions?.to || !emailFrom) {
    return false;
  }

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
    return true;
  }

  await transporter.sendMail(mailOptions);
  return true;
}

async function getSessionWithLock(sessionId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error('Get session error:', error);
    throw new Error('Session not found');
  }

  return data;
}

async function getCounsellorInfo(counsellorId) {
  const { data, error } = await supabase
    .from('counsellor_profiles')
    .select('user_id, name, department, gmail')
    .eq('user_id', counsellorId)
    .single();

  if (error || !data) {
    const email = await getUserEmail(counsellorId);
    return {
      id: counsellorId,
      name: 'Counsellor',
      department: null,
      email
    };
  }

  const fallbackEmail = await getUserEmail(counsellorId);
  return {
    id: data.user_id,
    name: data.name,
    department: data.department,
    email: data.gmail || fallbackEmail
  };
}

async function getStudentInfo(studentId) {
  const { data, error } = await supabase
    .from('student_profiles')
    .select('user_id, name, department')
    .eq('user_id', studentId)
    .single();

  if (error || !data) {
    return {
      id: studentId,
      name: 'Student',
      department: null
    };
  }

  return {
    id: data.user_id,
    name: data.name || 'Student',
    department: data.department
  };
}

async function getUserEmail(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (error || !data?.email) {
    return null;
  }

  return data.email;
}

async function createNotification(notification) {
  const payload = {
    recipient_id: notification.recipient_id,
    sender_id: notification.sender_id || null,
    session_id: notification.session_id || null,
    notification_type: notification.notification_type,
    title: notification.title,
    message: notification.message,
    data: notification.data || {},
    action_required: Boolean(notification.action_required),
    expires_at: notification.expires_at || null
  };

  const { data, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Create notification error:', error);
    console.log('[notification:fallback]', payload);
    return null;
  }

  console.log('[notification]', payload.title, payload.message);
  return data;
}

async function logSessionAudit(audit) {
  const { error } = await supabase
    .from('session_audit_log')
    .insert({
      session_id: audit.session_id,
      action: audit.action,
      actor_id: audit.actor_id || null,
      actor_type: audit.actor_type || null,
      old_status: audit.old_status || null,
      new_status: audit.new_status || null,
      reason: audit.reason || null,
      metadata: audit.metadata || {}
    });

  if (error) {
    console.error('Session audit log error:', error);
  }
}

async function resolveCurrentCandidateNotification(sessionId, recipientId) {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      action_required: false,
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('session_id', sessionId)
    .eq('recipient_id', recipientId)
    .eq('action_required', true);

  if (error) {
    console.error('Resolve notification error:', error);
  }
}

async function resolveNotificationsByType(sessionId, recipientId, notificationTypes = []) {
  let query = supabase
    .from('notifications')
    .update({
      is_read: true,
      action_required: false,
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('session_id', sessionId)
    .eq('recipient_id', recipientId);

  if (notificationTypes.length > 0) {
    query = query.in('notification_type', notificationTypes);
  }

  const { error } = await query;

  if (error) {
    console.error('Resolve typed notifications error:', error);
  }
}

async function finalizeIfReady(sessionId) {
  const session = await getSessionWithLock(sessionId);

  if (!session.counsellor_approved || !session.student_approved || !session.reassigned_counsellor_id) {
    return session;
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'reassigned',
      counsellor_id: session.reassigned_counsellor_id,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('Finalize session reassignment error:', error);
    throw new Error('Failed to finalize session reassignment');
  }

  await resolveCurrentCandidateNotification(sessionId, session.student_id);
  await resolveCurrentCandidateNotification(sessionId, session.reassigned_counsellor_id);

  const [student, counsellor] = await Promise.all([
    getStudentInfo(data.student_id),
    getCounsellorInfo(data.counsellor_id)
  ]);

  await createNotification({
    recipient_id: data.student_id,
    sender_id: data.counsellor_id,
    session_id: sessionId,
    notification_type: 'session_reassigned',
    title: 'Session Reassigned',
    message: `Your session has been scheduled with ${counsellor.name} on ${formatScheduleForMessage(data)}.`,
    data: {
      counsellor_name: counsellor.name,
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time
    }
  });

  await createNotification({
    recipient_id: data.counsellor_id,
    sender_id: data.student_id,
    session_id: sessionId,
    notification_type: 'session_reassigned',
    title: 'Reassigned Session Confirmed',
    message: `${student.name}'s reassigned session is confirmed for ${formatScheduleForMessage(data)}.`,
    data: {
      student_name: student.name,
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time
    }
  });

  const studentEmail = await getUserEmail(data.student_id);

  if (studentEmail) {
    await sendEmail({
      from: emailFrom,
      to: studentEmail,
      subject: 'Counselling Session Reassigned',
      text: `Your counselling session has been scheduled with ${counsellor.name} on ${formatScheduleForMessage(data)}.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Counselling Session Reassigned</h2>
          <p>Your counselling session has been scheduled with <strong>${counsellor.name}</strong>.</p>
          <p><strong>Schedule:</strong> ${formatScheduleForMessage(data)}</p>
        </div>
      `
    }).catch((mailError) => {
      console.error('Student reassignment confirmed email error:', mailError);
    });
  }

  if (counsellor.email) {
    await sendEmail({
      from: emailFrom,
      to: counsellor.email,
      subject: 'Counselling Session Confirmed',
      text: `${student.name}'s counselling session is confirmed for ${formatScheduleForMessage(data)}.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Counselling Session Confirmed</h2>
          <p><strong>${student.name}</strong>'s counselling session is confirmed.</p>
          <p><strong>Schedule:</strong> ${formatScheduleForMessage(data)}</p>
        </div>
      `
    }).catch((mailError) => {
      console.error('Counsellor reassignment confirmed email error:', mailError);
    });
  }

  await logSessionAudit({
    session_id: sessionId,
    action: 'finalize_reassignment',
    actor_type: 'system',
    old_status: session.status,
    new_status: 'reassigned',
    metadata: {
      counsellor_id: data.counsellor_id
    }
  });

  return data;
}

async function buildDayOrderSearchPlan(session) {
  const { data: dayOrders, error } = await supabase
    .from('day_orders')
    .select('id, order_name, order_number')
    .eq('is_active', true)
    .order('order_number', { ascending: true });

  if (error) {
    console.error('Load day orders error:', error);
    throw new Error('Failed to load day orders');
  }

  const activeDayOrders = dayOrders || [];
  if (activeDayOrders.length === 0) {
    return [{
      day_order_id: session.day_order_id,
      day_order_name: null,
      order_number: null,
      date: toDateOnly(session.date),
      dayOffset: 0
    }];
  }

  const startIndex = activeDayOrders.findIndex((dayOrder) => dayOrder.id === session.day_order_id);

  if (startIndex === -1) {
    return activeDayOrders.map((dayOrder, index) => ({
      day_order_id: dayOrder.id,
      day_order_name: dayOrder.order_name,
      order_number: dayOrder.order_number,
      date: addDays(session.date, index),
      dayOffset: index
    }));
  }

  return activeDayOrders.map((_, offset) => {
    const dayOrder = activeDayOrders[(startIndex + offset) % activeDayOrders.length];
    return {
      day_order_id: dayOrder.id,
      day_order_name: dayOrder.order_name,
      order_number: dayOrder.order_number,
      date: addDays(session.date, offset),
      dayOffset: offset
    };
  });
}

async function findAvailableCounsellor(session, excludedCounsellorIds = []) {
  const excludedIds = uniqueIds([
    session.counsellor_id,
    ...(session.reassignment_attempted_counsellor_ids || []),
    ...(excludedCounsellorIds || [])
  ]);

  const searchPlan = await buildDayOrderSearchPlan(session);
  const candidateDates = uniqueIds(searchPlan.map((entry) => entry.date));

  const [
    { data: counsellors, error: counsellorError },
    { data: availabilityRows, error: availabilityError },
    { data: appointments, error: appointmentError }
  ] = await Promise.all([
    supabase
      .from('counsellor_profiles')
      .select('id, user_id, name, department, created_at')
      .order('created_at', { ascending: true }),
    supabase
      .from('counsellor_availability')
      .select('counsellor_id, day_order_id, start_time, end_time, is_available')
      .eq('is_available', true),
    supabase
      .from('appointments')
      .select('id, counsellor_id, date, start_time, end_time, status')
      .in('date', candidateDates)
      .in('status', ACTIVE_SESSION_STATUSES)
  ]);

  if (counsellorError) {
    console.error('Find counsellors error:', counsellorError);
    throw new Error('Failed to load counsellors');
  }

  if (availabilityError) {
    console.error('Find counsellor availability error:', availabilityError);
    throw new Error('Failed to load counsellor availability');
  }

  if (appointmentError) {
    console.error('Find counsellor conflicting appointments error:', appointmentError);
    throw new Error('Failed to check counsellor availability');
  }

  const candidates = [];
  const now = new Date();

  for (const planEntry of searchPlan) {
    const slotsForDayOrder = (availabilityRows || []).filter((slot) => slot.day_order_id === planEntry.day_order_id);

    for (const profile of counsellors || []) {
      if (excludedIds.includes(profile.user_id)) {
        continue;
      }

      const profileKeys = [profile.id, profile.user_id];
      const matchingSlots = slotsForDayOrder.filter((slot) => profileKeys.includes(slot.counsellor_id));

      for (const slot of matchingSlots) {
        const startTime = formatTimeHHMM(slot.start_time);
        const endTime = formatTimeHHMM(slot.end_time);

        if (!startTime || !endTime || startTime >= endTime) {
          continue;
        }

        if (getDateTime(planEntry.date, endTime) <= now) {
          continue;
        }

        const hasConflict = (appointments || []).some((appointment) => {
          if (appointment.id === session.id || appointment.counsellor_id !== profile.user_id) {
            return false;
          }

          return toDateOnly(appointment.date) === planEntry.date
            && overlaps(appointment.start_time, appointment.end_time, startTime, endTime);
        });

        if (hasConflict) {
          continue;
        }

        candidates.push({
          counsellor_id: profile.user_id,
          name: profile.name,
          department: profile.department,
          date: planEntry.date,
          day_order_id: planEntry.day_order_id,
          day_order_name: planEntry.day_order_name,
          order_number: planEntry.order_number,
          start_time: startTime,
          end_time: endTime,
          dayOffset: planEntry.dayOffset,
          timeScore: planEntry.dayOffset === 0
            ? Math.abs(timeToMinutes(startTime) - timeToMinutes(session.start_time))
            : timeToMinutes(startTime),
          counsellorCreatedAt: profile.created_at || ''
        });
      }
    }
  }

  candidates.sort((a, b) => (
    a.dayOffset - b.dayOffset
    || a.timeScore - b.timeScore
    || a.start_time.localeCompare(b.start_time)
    || a.counsellorCreatedAt.localeCompare(b.counsellorCreatedAt)
    || a.name.localeCompare(b.name)
  ));

  return candidates[0] || null;
}

async function assignNextCounsellor(session, options = {}) {
  const { excludedCounsellorIds = [], actorId = null, reason = '' } = options;
  const candidate = await findAvailableCounsellor(session, excludedCounsellorIds);
  const attemptedIds = uniqueIds([
    ...(session.reassignment_attempted_counsellor_ids || []),
    ...(excludedCounsellorIds || [])
  ]);

  if (!candidate) {
    const { data, error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        reassigned_counsellor_id: null,
        counsellor_approved: false,
        student_approved: false,
        reassignment_attempted_counsellor_ids: attemptedIds,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id)
      .select()
      .single();

    if (error) {
      console.error('Mark session cancelled after reassignment failure error:', error);
      throw new Error('Failed to cancel session');
    }

    await createNotification({
      recipient_id: data.student_id,
      sender_id: actorId,
      session_id: data.id,
      notification_type: 'session_cancelled',
      title: 'Session Cancelled',
      message: 'A replacement counsellor is not available right now. Please book a session later.',
      data: {
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        reason
      }
    });

    const studentEmail = await getUserEmail(data.student_id);
    if (studentEmail) {
      await sendEmail({
        from: emailFrom,
        to: studentEmail,
        subject: 'Counselling Session Could Not Be Reassigned',
        text: 'The counsellor is not available right now. Please book a session later.',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Counselling Session Update</h2>
            <p>The counsellor is not available right now.</p>
            <p>Please book a session later from the website.</p>
          </div>
        `
      }).catch((mailError) => {
        console.error('Student unavailable email error:', mailError);
      });
    }

    await logSessionAudit({
      session_id: data.id,
      action: 'reassignment_exhausted',
      actor_id: actorId,
      actor_type: actorId ? 'user' : 'system',
      old_status: session.status,
      new_status: 'cancelled',
      reason,
      metadata: { attempted_ids: attemptedIds }
    });

    return {
      session: data,
      assignedCounsellor: null,
      message: 'No counsellor available. Student has been asked to book later.'
    };
  }

  const nextAttemptedIds = uniqueIds([...attemptedIds, candidate.counsellor_id]);
  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'pending_reassign',
      reassigned_counsellor_id: candidate.counsellor_id,
      counsellor_approved: false,
      student_approved: false,
      date: candidate.date,
      day_order_id: candidate.day_order_id,
      start_time: candidate.start_time,
      end_time: candidate.end_time,
      start_datetime: getDateTime(candidate.date, candidate.start_time).toISOString(),
      end_datetime: getDateTime(candidate.date, candidate.end_time).toISOString(),
      reassignment_attempted_counsellor_ids: nextAttemptedIds,
      updated_at: new Date().toISOString()
    })
    .eq('id', session.id)
    .select()
    .single();

  if (error) {
    console.error('Assign next counsellor error:', error);
    throw new Error('Failed to assign next counsellor');
  }

  await resolveNotificationsByType(data.id, data.student_id, ['student_reassignment_approval', 'student_confirmation_pending']);
  await createNotification({
    recipient_id: data.student_id,
    sender_id: actorId,
    session_id: data.id,
    notification_type: 'student_reassignment_approval',
    title: 'New Counsellor Available',
    message: `${candidate.name} is available on ${formatScheduleForMessage(candidate)}. If you are comfortable taking counselling from them, please approve on the website.`,
    data: {
      counsellor_name: candidate.name,
      day_order_id: candidate.day_order_id,
      day_order_name: candidate.day_order_name,
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time
    },
    action_required: true,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });

  const studentEmail = await getUserEmail(data.student_id);
  if (studentEmail) {
    await sendEmail({
      from: emailFrom,
      to: studentEmail,
      subject: 'Counselling Reassignment Approval Needed',
      text: `${candidate.name} is available on ${formatScheduleForMessage(candidate)}. If you are comfortable taking counselling from them, please open the website and approve to proceed.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Counselling Reassignment Approval Needed</h2>
          <p>Your counsellor cancelled the session.</p>
          <p><strong>${candidate.name}</strong> is available on <strong>${formatScheduleForMessage(candidate)}</strong>.</p>
          <p>If you are comfortable taking counselling from them, please open the website and approve to proceed.</p>
        </div>
      `
    }).catch((mailError) => {
      console.error('Student reassignment offer email error:', mailError);
    });
  }

  await logSessionAudit({
    session_id: data.id,
    action: 'assign_candidate',
    actor_id: actorId,
    actor_type: actorId ? 'user' : 'system',
    old_status: session.status,
    new_status: 'pending_reassign',
    reason,
    metadata: {
      assigned_counsellor_id: candidate.counsellor_id,
      candidate_date: candidate.date,
      candidate_start_time: candidate.start_time,
      candidate_end_time: candidate.end_time,
      candidate_day_order_id: candidate.day_order_id
    }
  });

  return {
    session: data,
    assignedCounsellor: candidate,
    message: `Student approval request sent for ${candidate.name}.`
  };
}

async function cancelSessionByCounsellor(sessionId, counsellorId, reason = '') {
  const session = await getSessionWithLock(sessionId);

  if (session.counsellor_id !== counsellorId) {
    throw new Error('Only the assigned counsellor can cancel this session');
  }

  if (!['scheduled', 'reassigned'].includes(session.status)) {
    throw new Error(`Cannot cancel a session with status "${session.status}"`);
  }

  const assignment = await assignNextCounsellor(session, {
    excludedCounsellorIds: [counsellorId],
    actorId: counsellorId,
    reason
  });

  await logSessionAudit({
    session_id: sessionId,
    action: 'cancel_by_counsellor',
    actor_id: counsellorId,
    actor_type: 'counsellor',
    old_status: session.status,
    new_status: assignment.session.status,
    reason
  });

  return {
    status: assignment.session.status,
    message: assignment.message,
    firstCandidate: assignment.assignedCounsellor,
    session: assignment.session
  };
}

async function handleCounsellorResponse(sessionId, counsellorId, response) {
  const session = await getSessionWithLock(sessionId);

  if (!['accept', 'reject'].includes(response)) {
    throw new Error('Response must be either "accept" or "reject"');
  }

  if (session.status !== 'pending_reassign') {
    await resolveCurrentCandidateNotification(sessionId, counsellorId);
    return {
      status: session.status,
      message: 'This reassignment request has already been resolved.',
      session
    };
  }

  if (response === 'accept') {
    if (!session.student_approved) {
      await resolveCurrentCandidateNotification(sessionId, counsellorId);
      return {
        status: session.status,
        message: 'The student has not approved this reassignment yet.',
        session
      };
    }

    if (session.counsellor_approved) {
      await resolveCurrentCandidateNotification(sessionId, counsellorId);
      return {
        status: session.status,
        message: 'This reassignment was already accepted.',
        session
      };
    }

    if (session.reassigned_counsellor_id !== counsellorId) {
      await resolveCurrentCandidateNotification(sessionId, counsellorId);
      return {
        status: session.status,
        message: 'This reassignment request is no longer active.',
        session
      };
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({
        counsellor_approved: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Counsellor accept reassignment error:', error);
      throw new Error('Failed to record counsellor response');
    }

    await resolveCurrentCandidateNotification(sessionId, counsellorId);

    await logSessionAudit({
      session_id: sessionId,
      action: 'counsellor_accept',
      actor_id: counsellorId,
      actor_type: 'counsellor',
      old_status: session.status,
      new_status: data.status
    });

    const finalized = await finalizeIfReady(sessionId);

    return {
      status: finalized.status,
      message: finalized.status === 'reassigned'
        ? 'Counsellor accepted. Session reassigned successfully.'
        : 'Counsellor response recorded.',
      session: finalized
    };
  }

  if (session.reassigned_counsellor_id !== counsellorId) {
    await resolveCurrentCandidateNotification(sessionId, counsellorId);
    return {
      status: session.status,
      message: 'This reassignment request is no longer active.',
      session
    };
  }

  await resolveCurrentCandidateNotification(sessionId, counsellorId);
  const assignment = await assignNextCounsellor(session, {
    excludedCounsellorIds: [counsellorId],
    actorId: counsellorId,
    reason: 'Counsellor rejected reassignment'
  });

  await logSessionAudit({
    session_id: sessionId,
    action: 'counsellor_reject',
    actor_id: counsellorId,
    actor_type: 'counsellor',
    old_status: session.status,
    new_status: assignment.session.status,
    reason: 'Counsellor rejected reassignment'
  });

  return {
    status: assignment.session.status,
    message: assignment.message,
    nextCandidate: assignment.assignedCounsellor,
    session: assignment.session
  };
}

async function handleStudentResponse(sessionId, studentId, response) {
  const session = await getSessionWithLock(sessionId);

  if (!['accept', 'reject'].includes(response)) {
    throw new Error('Response must be either "accept" or "reject"');
  }

  if (session.student_id !== studentId) {
    throw new Error('Only the student on this session can respond');
  }

  if (session.status !== 'pending_reassign') {
    await resolveNotificationsByType(sessionId, studentId, ['student_reassignment_approval', 'student_confirmation_pending']);
    return {
      status: session.status,
      message: 'This reassignment request has already been resolved.',
      session
    };
  }

  if (!session.reassigned_counsellor_id) {
    throw new Error('No replacement counsellor is available for this request');
  }

  if (response === 'accept') {
    if (session.student_approved) {
      await resolveNotificationsByType(sessionId, studentId, ['student_reassignment_approval', 'student_confirmation_pending']);
      return {
        status: session.status,
        message: 'This reassignment was already approved.',
        session
      };
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({
        student_approved: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Student accept reassignment error:', error);
      throw new Error('Failed to record student response');
    }

    await resolveNotificationsByType(sessionId, studentId, ['student_reassignment_approval', 'student_confirmation_pending']);

    const [student, counsellor] = await Promise.all([
      getStudentInfo(studentId),
      getCounsellorInfo(data.reassigned_counsellor_id)
    ]);

    await resolveCurrentCandidateNotification(sessionId, data.reassigned_counsellor_id);
    await createNotification({
      recipient_id: data.reassigned_counsellor_id,
      sender_id: studentId,
      session_id: data.id,
      notification_type: 'reassignment_request',
      title: 'Session Reassignment Request',
      message: `${student.name} is comfortable proceeding with you on ${formatScheduleForMessage(data)}. Do you want to take this counselling session?`,
      data: {
        student_name: student.name,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time
      },
      action_required: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    if (counsellor.email) {
      await sendEmail({
        from: emailFrom,
        to: counsellor.email,
        subject: 'Counselling Reassignment Request',
        text: `${student.name} is comfortable proceeding with you on ${formatScheduleForMessage(data)}. Please open the website and accept or reject this counselling request.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Counselling Reassignment Request</h2>
            <p><strong>${student.name}</strong> is comfortable proceeding with you.</p>
            <p><strong>Schedule:</strong> ${formatScheduleForMessage(data)}</p>
            <p>Please open the website and accept or reject this counselling request.</p>
          </div>
        `
      }).catch((mailError) => {
        console.error('Counsellor reassignment request email error:', mailError);
      });
    }

    await logSessionAudit({
      session_id: sessionId,
      action: 'student_accept',
      actor_id: studentId,
      actor_type: 'student',
      old_status: session.status,
      new_status: data.status
    });

    return {
      status: data.status,
      message: 'Student approved. Waiting for counsellor acceptance.',
      session: data
    };
  }

  await resolveNotificationsByType(sessionId, studentId, ['student_reassignment_approval', 'student_confirmation_pending']);
  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      reassigned_counsellor_id: null,
      counsellor_approved: false,
      student_approved: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('Student reject reassignment error:', error);
    throw new Error('Failed to reject reassignment');
  }

  if (session.counsellor_approved) {
    const counsellor = await getCounsellorInfo(session.reassigned_counsellor_id);
    await createNotification({
      recipient_id: counsellor.id,
      sender_id: studentId,
      session_id: sessionId,
      notification_type: 'student_rejected',
      title: 'Student Declined Reassignment',
      message: `The student did not accept counselling with ${counsellor.name}. No meeting has been scheduled.`,
      data: {
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time
      }
    });
  }

  await logSessionAudit({
    session_id: sessionId,
    action: 'student_reject',
    actor_id: studentId,
    actor_type: 'student',
    old_status: session.status,
    new_status: data.status,
    reason: 'Student rejected reassignment'
  });

  return {
    status: data.status,
    message: 'Request rejected. No meeting has been scheduled.',
    session: data
  };
}

module.exports = {
  getSessionWithLock,
  cancelSessionByCounsellor,
  handleCounsellorResponse,
  handleStudentResponse,
  findAvailableCounsellor,
  getCounsellorInfo,
  createNotification,
  logSessionAudit
};
