/**
 * crisisService.js
 * ─────────────────────────────────────────────────────────────
 * Handles all server-side crisis detection logic:
 *   1. Keyword scanning (comprehensive list)
 *   2. Available counsellor lookup from Supabase
 *   3. Fetch full conversation history for the student session
 *   4. Insert row into `crisis_alerts` table
 *   5. Save conversation snapshot to `session_transcripts` (severity: "critical")
 *   6. Fire email alert (includes embedded transcript) via SendGrid / SMTP
 *   7. (Optional) SMS alert via Twilio
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const nodemailer       = require('nodemailer');
const axios            = require('axios');

// ── Supabase (service role — bypasses RLS) ───────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Email transport (SMTP fallback) ─────────────────────────
const emailTransporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   Number(process.env.EMAIL_PORT)  || 587,
  secure: process.env.EMAIL_SECURE === 'true' || Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER || 'apikey',
    pass: process.env.EMAIL_PASS || process.env.SENDGRID_API_KEY,
  },
});

// ── Crisis keyword list ──────────────────────────────────────
const CRISIS_KEYWORDS = [
  // Explicit suicidal ideation
  'kill myself', 'killing myself', 'want to kill myself', 'going to kill myself',
  'suicide', 'suicidal', 'commit suicide',
  'end my life', 'ending my life', 'take my life', 'taking my life',
  'want to die', 'want to be dead', 'wish i was dead', 'rather be dead',
  // Hopelessness / giving up
  "can't go on", 'cannot go on', "don't want to be here",
  'no reason to live', 'no point in living',
  'better off dead', 'better off without me', 'not worth living',
  'life is not worth', 'end it all', 'end everything', 'give up on life',
  // Self-harm
  'hurt myself', 'hurting myself', 'harm myself', 'harming myself',
  'cut myself', 'cutting myself', 'self harm', 'self-harm',
  // Misc strong distress
  'worthless and hopeless', 'no way out', 'there is no way out', 'want to disappear'
];

// ── 1. Crisis keyword scanner ────────────────────────────────

/**
 * @param {string} message
 * @returns {{ detected: boolean, matched: string[] }}
 */
function scanForCrisis(message) {
  if (!message || typeof message !== 'string') return { detected: false, matched: [] };
  const lower   = message.toLowerCase();
  const matched = CRISIS_KEYWORDS.filter(kw => lower.includes(kw));
  return { detected: matched.length > 0, matched };
}

// ── 2. Available counsellor lookup ──────────────────────────

/**
 * @returns {{ id: string|null, name: string|null, email: string|null }}
 */
async function findAvailableCounsellor() {
  try {
    // 1. Fetch available counsellors
    const nowISO = new Date().toISOString();
    const { data: counsellors, error } = await supabase
      .from('counsellor_profiles')
      .select('id, name, user_id, users!inner(email)')
      .eq('is_available', true);

    if (error || !counsellors || counsellors.length === 0) {
      throw new Error('No available counsellor');
    }

    // 2. Fetch active assigned alerts counts for today to balance load
    const today = new Date().toISOString().split('T')[0];
    const counsellorIds = counsellors.map(c => c.id);
    
    const { data: alerts } = await supabase
      .from('crisis_alerts')
      .select('assigned_counsellor_id')
      .gte('created_at', today)
      .eq('resolved', false)
      .in('assigned_counsellor_id', counsellorIds);
      
    // Count alerts per counsellor
    const loads = {};
    counsellorIds.forEach(id => loads[id] = 0);
    if (alerts) {
       alerts.forEach(a => {
         if (loads[a.assigned_counsellor_id] !== undefined) {
           loads[a.assigned_counsellor_id]++;
         }
       });
    }

    // Sort counsellors by lowest active load
    counsellors.sort((a, b) => loads[a.id] - loads[b.id]);
    
    const picked = counsellors[0];
    return { id: picked.id, name: picked.name || 'Duty Counsellor', email: picked.users?.email || null };
  } catch (_) { 
    // Fallback: Query college_config for designated fallback email
    try {
      const { data } = await supabase.from('college_config').select('fallback_admin_email').limit(1).maybeSingle();
      if (data && data.fallback_admin_email) {
         console.log('Routing crisis email to fallback_admin_email');
         return { id: null, name: 'Fallback Administration', email: data.fallback_admin_email };
      }
    } catch(e) {}
  }

  // Absolute fallback.
  return { id: null, name: null, email: null };
}

// ── 3. Session history fetch ─────────────────────────────────

/**
 * Fetches the conversation messages for the given session or, if no
 * sessionId is supplied, the most recent session for the student.
 *
 * @param {string} studentId  - UUID of the student
 * @param {string|null} sessionId - specific session UUID (preferred)
 * @returns {{ sessionId: string|null, messages: Array }}
 */
async function fetchSessionHistory(studentId, sessionId = null) {
  if (!studentId) return { sessionId: null, messages: [] };

  try {
    let query = supabase
      .from('sessions')
      .select('id, messages')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1);

    // If we already know the session, target it directly
    if (sessionId) {
      query = supabase
        .from('sessions')
        .select('id, messages')
        .eq('id', sessionId)
        .single();
    }

    const { data, error } = await (sessionId ? query : query.maybeSingle());

    if (error) {
      console.warn('⚠️  Could not fetch session history:', error.message);
      return { sessionId: null, messages: [] };
    }

    if (!data) return { sessionId: null, messages: [] };

    const messages = Array.isArray(data.messages) ? data.messages : [];
    return { sessionId: data.id, messages };
  } catch (err) {
    console.warn('⚠️  fetchSessionHistory error:', err.message);
    return { sessionId: null, messages: [] };
  }
}

// ── 4. Insert crisis_alerts row ──────────────────────────────

async function insertCrisisAlert({ studentId, studentEmail, messageSnippet, keywordsMatched, counsellor }) {
  if (!studentId) return null;

  const { data, error } = await supabase
    .from('crisis_alerts')
    .insert({
      student_id:               studentId,
      student_email:            studentEmail || null,
      message_snippet:          messageSnippet.slice(0, 280),
      keywords_matched:         keywordsMatched,
      assigned_counsellor_id:   counsellor.id   || null,
      assigned_counsellor_name: counsellor.name || null,
      severity:                 'HIGH',
      notification_sent:        false,
      resolved:                 false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ crisis_alerts insert error:', error.message);
    return null;
  }

  console.log(`🚨 Crisis alert inserted — id: ${data.id}`);
  return data.id;
}

// ── 5. Save session_transcripts row ─────────────────────────

/**
 * Saves a full conversation snapshot to `session_transcripts`
 * with severity = "critical" so the counsellor dashboard can surface it.
 *
 * @returns {string|null} - UUID of inserted transcript row
 */
async function saveSessionTranscript({
  studentId,
  sessionId,
  alertId,
  messages,
  flaggedMessage,
  keywordsMatched,
}) {
  if (!studentId) return null;

  const { data, error } = await supabase
    .from('session_transcripts')
    .insert({
      student_id:      studentId,
      session_id:      sessionId      || null,
      crisis_alert_id: alertId        || null,
      severity:        'critical',
      messages:        messages,
      flagged_message: flaggedMessage.slice(0, 500),
      keywords_matched: keywordsMatched,
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ session_transcripts insert error:', error.message);
    return null;
  }

  console.log(`📋 Session transcript saved — id: ${data.id}`);
  return data.id;
}

// ── 6. Email helpers ─────────────────────────────────────────

/**
 * Formats a JSONB messages array into an HTML table for the email.
 * Shows at most the last `limit` messages.
 */
function formatTranscriptHtml(messages, limit = 15) {
  if (!messages || messages.length === 0) {
    return '<p style="color:#6b7280;font-style:italic;">No prior conversation history available.</p>';
  }

  const recent = messages.slice(-limit);
  const rows   = recent.map(msg => {
    const isUser    = msg.role === 'user';
    const bgColor   = isUser ? '#eff6ff' : '#f0fdf4';
    const label     = isUser ? '🧑 <b>Student:</b>' : '🤖 <b>Bot:</b>';
    const labelColor = isUser ? '#1d4ed8'  : '#166534';
    const ts        = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '';

    return `
      <tr style="background:${bgColor};">
        <td style="padding:8px 12px;white-space:nowrap;font-size:12px;color:${labelColor};font-weight:600;vertical-align:top;border-bottom:1px solid #e5e7eb;">
          ${label}<br/><span style="color:#9ca3af;font-weight:400;">${ts}</span>
        </td>
        <td style="padding:8px 12px;font-size:13px;color:#1f2937;line-height:1.5;border-bottom:1px solid #e5e7eb;">
          ${(msg.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </td>
      </tr>
    `;
  }).join('');

  const omittedCount = messages.length - recent.length;
  const omittedNote  = omittedCount > 0
    ? `<p style="color:#6b7280;font-size:12px;text-align:center;margin:8px 0 0;">(${omittedCount} earlier message${omittedCount > 1 ? 's' : ''} omitted — view full history in admin dashboard)</p>`
    : '';

  return `
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;width:140px;">Sender</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Message</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${omittedNote}
  `;
}

function buildCrisisEmailHtml({
  studentId, studentEmail, messageSnippet, keywordsMatched,
  counsellor, alertId, transcriptId, timestamp, conversationHistory,
}) {
  const transcriptHtml = formatTranscriptHtml(conversationHistory);

  return `
    <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;border:2px solid #dc2626;border-radius:10px;overflow:hidden;">

      <!-- Header -->
      <div style="background:#dc2626;padding:20px 24px;">
        <h2 style="color:#fff;margin:0;">🚨 URGENT: Crisis Keyword Detected</h2>
        <p style="color:#fecaca;margin:4px 0 0;font-size:14px;">Counselling AI — Automated Safety Alert</p>
      </div>

      <!-- Alert meta -->
      <div style="padding:24px;background:#fff;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
          <tr><td style="padding:5px 0;color:#6b7280;width:180px;"><strong>Alert ID</strong></td><td style="color:#111827;">${alertId || 'N/A'}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;width:180px;"><strong>Session ID</strong></td><td style="color:#111827;">${emailData.sessionId || 'N/A'}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;"><strong>Timestamp</strong></td><td style="color:#111827;">${timestamp}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;"><strong>Student / Roll No</strong></td><td style="color:#111827;">${emailData.studentProfile?.name || 'Unknown'} (${studentId})</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;"><strong>Student Email</strong></td><td style="color:#111827;">${studentEmail || 'Unknown'}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;"><strong>Keywords Matched</strong></td><td style="color:#dc2626;font-weight:600;">${keywordsMatched.join(', ')}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;"><strong>Assigned To</strong></td><td style="color:#111827;">${counsellor.name || 'Unassigned'}</td></tr>
        </table>

        <!-- Flagged message -->
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:4px;margin-bottom:24px;">
          <strong style="color:#991b1b;font-size:13px;">⚠ Flagged Message:</strong>
          <p style="color:#1f2937;margin:8px 0 0;font-style:italic;font-size:14px;">
            "${messageSnippet.slice(0, 280)}${messageSnippet.length > 280 ? '…' : ''}"
          </p>
        </div>

        <!-- Conversation transcript -->
        <div style="margin-bottom:24px;">
          <h3 style="font-size:15px;color:#111827;margin:0 0 12px;display:flex;align-items:center;gap:6px;">
            📋 Full Conversation Transcript
            <span style="font-size:12px;color:#6b7280;font-weight:400;">(last ${Math.min((conversationHistory || []).length, 15)} messages)</span>
          </h3>
          ${transcriptHtml}
        </div>

        <!-- Action required -->
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:16px;border-radius:6px;">
          <p style="margin:0;color:#166534;font-weight:700;font-size:14px;">⚡ Action Required</p>
          <p style="margin:8px 0 16px;color:#15803d;font-size:13px;">
            The student has been shown the emergency helpline intervention card. Please review the
            <strong>session_transcripts</strong> in the admin dashboard and reach out immediately.
          </p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/counsellor/dashboard" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:6px;font-size:13px;">
            View Counsellor Dashboard ↗
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#f9fafb;padding:14px 24px;text-align:center;font-size:11px;color:#9ca3af;">
        Automated alert · College Counselling AI · Do not reply to this email
      </div>
    </div>
  `;
}

// ── 7. Send email ────────────────────────────────────────────

async function sendCrisisEmail({ adminEmail, counsellorEmail, ...emailData }) {
  const from       = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@counselling.edu';
  const recipients = [adminEmail, counsellorEmail].filter(Boolean);
  const subject    = `🚨 URGENT: Crisis Alert — Student ${(emailData.studentId || '').slice(0, 8)}`;
  const html       = buildCrisisEmailHtml(emailData);

  const sendgridKey = process.env.SENDGRID_API_KEY || process.env.EMAIL_PASS;

  if (sendgridKey && String(sendgridKey).startsWith('SG.')) {
    try {
      await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [{ to: recipients.map(email => ({ email })) }],
          from: { email: from.match(/<(.+)>$/)?.[1] || from },
          subject,
          content: [{ type: 'text/html', value: html }],
        },
        { headers: { Authorization: `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      console.log('📧 Crisis email sent via SendGrid to:', recipients.join(', '));
      return true;
    } catch (err) {
      console.error('❌ SendGrid crisis email failed:', err.response?.data || err.message);
    }
  }

  try {
    await emailTransporter.sendMail({ from, to: recipients.join(', '), subject, html });
    console.log('📧 Crisis email sent via SMTP to:', recipients.join(', '));
    return true;
  } catch (err) {
    console.error('❌ SMTP crisis email failed:', err.message);
    return false;
  }
}

// ── 8. Twilio SMS ────────────────────────────────────────────

async function sendCrisisSms({ studentId, studentEmail, keywordsMatched, counsellor }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  
  // 1. Determine if it is after hours (9am - 5pm, Mon-Fri IST)
  const now = new Date();
  const indiaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  const isWeekend = indiaTime.getDay() === 0 || indiaTime.getDay() === 6;
  const isBusinessHours = !isWeekend && indiaTime.getHours() >= 9 && indiaTime.getHours() < 17;
  const isAfterHours = !isBusinessHours;

  let toNumber = process.env.TWILIO_ADMIN_NUMBER;

  // 2. Query college_config for designated emergency number if after hours
  if (isAfterHours) {
    try {
      const { data } = await supabase
        .from('college_config')
        .select('emergency_duty_number')
        .limit(1)
        .maybeSingle();

      if (data && data.emergency_duty_number) {
        toNumber = data.emergency_duty_number;
        console.log('🌙 Routing crisis SMS to after-hours emergency duty number:', toNumber);
      }
    } catch (_) { /* ignore and fallback to env number */ }
  }

  if (!accountSid || !authToken || !fromNumber || !toNumber) return false;

  const body = [
    '🚨 CRISIS ALERT' + (isAfterHours ? ' (AFTER HOURS)' : ''),
    `Student: ${studentEmail || (studentId || '').slice(0, 8) || 'Unknown'}`,
    `Keyword: ${keywordsMatched[0] || 'crisis'}`,
    `Assigned to: ${counsellor?.name || 'Unassigned'}`,
    'Check admin dashboard immediately.',
  ].join('\n');

  try {
    const { default: axios } = await import('axios');
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({ From: fromNumber, To: toNumber, Body: body }),
      { auth: { username: accountSid, password: authToken }, timeout: 10000 }
    );
    console.log('📱 Crisis SMS sent via Twilio to:', toNumber);
    return true;
  } catch (err) {
    console.error('❌ Twilio SMS failed:', err.response?.data || err.message);
    return false;
  }
}

async function markNotificationSent(alertId) {
  if (!alertId) return;
  await supabase.from('crisis_alerts').update({ notification_sent: true }).eq('id', alertId);
}

// ── Main exported function ────────────────────────────────────

/**
 * Full crisis pipeline:
 *   scan → counsellor → fetch history → crisis_alert → session_transcript → email → SMS
 *
 * @param {Object} opts
 * @param {string}      opts.message       - Full student message
 * @param {string|null} opts.studentId     - Auth user UUID
 * @param {string|null} opts.studentEmail  - Student email if known
 * @param {string|null} opts.sessionId     - Session UUID from the chat session (preferred for history lookup)
 */
async function handleCrisisIfDetected({ message, studentId, studentEmail, sessionId = null }) {
  const { detected, matched } = scanForCrisis(message);
  if (!detected) return { detected: false, alertId: null, transcriptId: null, matched: [] };

  console.warn(`🚨 Crisis keywords detected for student ${studentId || 'anonymous'}:`, matched);

  // 1. Find available counsellor
  const counsellor = await findAvailableCounsellor();

  // 1b. Fetch student profile to get roll number / name context
  let studentProfile = null;
  if (studentId) {
    const { data } = await supabase.from('student_profiles').select('name, year, course').eq('user_id', studentId).maybeSingle();
    studentProfile = data;
  }

  // 2. Fetch conversation history (use sessionId if available, otherwise latest session)
  const { sessionId: resolvedSessionId, messages: conversationHistory } =
    await fetchSessionHistory(studentId, sessionId);

  // 3. Insert crisis_alerts row
  const alertId = await insertCrisisAlert({
    studentId,
    studentEmail,
    messageSnippet:  message,
    keywordsMatched: matched,
    counsellor,
  });

  // 4. Save session_transcripts row (critical severity)
  const transcriptId = await saveSessionTranscript({
    studentId,
    sessionId:       resolvedSessionId,
    alertId,
    messages:        conversationHistory,
    flaggedMessage:  message,
    keywordsMatched: matched,
  });

  // 5. Notifications (fire-and-forget — don't block the chat response)
  const adminEmail      = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM;
  const counsellorEmail = counsellor.email;
  const timestamp       = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  Promise.allSettled([
    sendCrisisEmail({
      adminEmail,
      counsellorEmail,
      studentId:           studentId || 'anonymous',
      studentEmail,
      studentProfile,
      messageSnippet:      message,
      keywordsMatched:     matched,
      counsellor,
      alertId,
      transcriptId,
      sessionId:           resolvedSessionId,
      timestamp,
      conversationHistory,  // ← embedded in email
    }),
    sendCrisisSms({ studentId, studentEmail, keywordsMatched: matched, counsellor }),
  ]).then(results => {
    const emailOk = results[0].status === 'fulfilled' && results[0].value;
    const smsOk   = results[1].status === 'fulfilled' && results[1].value;
    if (emailOk || smsOk) markNotificationSent(alertId);
  }).catch(err => console.error('Notification pipeline error:', err));

  return { detected: true, alertId, transcriptId, matched };
}

module.exports = {
  scanForCrisis,
  handleCrisisIfDetected,
  CRISIS_KEYWORDS,
};
