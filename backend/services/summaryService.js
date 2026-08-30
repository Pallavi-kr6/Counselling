/**
 * summaryService.js
 * ─────────────────────────────────────────────────────────────
 * Asynchronously generates AI summaries of student chats and
 * emails them directly to their assigned counsellor.
 * Uses a cooldown mechanism to prevent spamming the counsellor.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const { sendEmail, emailFrom } = require('./emailService');
const Groq = require('groq-sdk');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cooldown cache to prevent spamming (10-minute cooldown per student)
const COOLDOWN_MS = 10 * 60 * 1000;
const lastSentCache = new Map();

/**
 * Summarizes the latest session messages and emails the assigned counsellor.
 *
 * @param {string} studentId  - UUID of the student
 * @param {string} sessionId  - UUID of the active session
 */
async function sendChatSummaryToCounsellor(studentId, sessionId) {
  if (!studentId || !sessionId) return;

  // 1. Check Cooldown
  const now = Date.now();
  const lastSent = lastSentCache.get(studentId) || 0;
  if (now - lastSent < COOLDOWN_MS) {
    console.log(`[Summary] Cooldown active for student ${studentId}. Skipping summary email.`);
    return;
  }

  try {
    // 2. Fetch assigned counsellor ID from student_profiles
    const { data: profile, error: profileError } = await supabase
      .from('student_profiles')
      .select('name, assigned_counsellor_id')
      .eq('user_id', studentId)
      .maybeSingle();

    if (profileError || !profile || !profile.assigned_counsellor_id) {
      // Student is either not registered or has no assigned counsellor
      return;
    }

    const studentName = profile.name || 'Anonymous Student';

    // 3. Fetch counsellor profile and email
    const { data: counsellor } = await supabase
      .from('counsellor_profiles')
      .select('name, user_id')
      .eq('user_id', profile.assigned_counsellor_id)
      .maybeSingle();

    if (!counsellor) return;

    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', counsellor.user_id)
      .maybeSingle();

    const counsellorEmail = userData?.email;
    if (!counsellorEmail) {
      console.warn(`[Summary] Assigned counsellor ${counsellor.name} has no email on record.`);
      return;
    }

    // 4. Fetch the recent messages from the sessions table
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('messages')
      .eq('id', sessionId)
      .single();

    if (!sessionData || !Array.isArray(sessionData.messages) || sessionData.messages.length === 0) {
      return;
    }

    // Get the last 15 messages for summary generation
    const messagesToSummarize = sessionData.messages.slice(-15);
    const conversationText = messagesToSummarize
      .map(m => `${m.role === 'user' ? 'Student' : 'Bot'}: ${m.content}`)
      .join('\n');

    // 5. Generate Summary using Groq
    if (!process.env.GROQ_API_KEY) {
      console.warn('[Summary] GROQ_API_KEY is missing. AI summary cannot be generated.');
      return;
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [
        {
          role: 'system',
          content: 'You are a professional clinical summary assistant. Summarize the following dialogue between a student and an AI therapist in 2-3 sentences. Focus strictly on the student\'s mood, key topics mentioned, and general psychological state.'
        },
        { role: 'user', content: conversationText }
      ],
      temperature: 0.3,
      max_tokens: 150
    });

    const aiSummary = completion.choices[0].message.content.trim();

    // 6. Send Email to the Assigned Counsellor
    const subject = `📝 Chat Summary: Student ${studentName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #2ec4b6; padding: 20px; color: #fff;">
          <h2 style="margin: 0;">Student Chat Update</h2>
          <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">Mindful Space — Clinical Brief</p>
        </div>
        <div style="padding: 24px; background: #fff;">
          <p>Hello <strong>${counsellor.name || 'Counsellor'}</strong>,</p>
          <p>Your assigned student <strong>${studentName}</strong> is currently chatting with the AI bot. Here is a summary of their recent interactions:</p>
          
          <div style="background: #f8fafc; border-left: 4px solid #2ec4b6; padding: 16px; margin: 20px 0; border-radius: 4px; line-height: 1.6; color: #334155; font-style: italic;">
            "${aiSummary}"
          </div>

          <p style="font-size: 13px; color: #64748b;">
            To view their full clinical history, mood logs, and transcripts, please log in to your portal.
          </p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" style="display: inline-block; background: #2ec4b6; color: #fff; text-decoration: none; font-weight: 600; padding: 10px 16px; border-radius: 6px; font-size: 13px; margin-top: 10px;">
            Go to Counsellor Dashboard ↗
          </a>
        </div>
        <div style="background: #f1f5f9; padding: 12px; text-align: center; font-size: 11px; color: #94a3b8;">
          Automated alert · Mindful Space Counselling · Do not reply
        </div>
      </div>
    `;

    await sendEmail({
      to: counsellorEmail,
      subject,
      html
    });

    console.log(`[Summary] Sent summary email for student ${studentName} to counsellor ${counsellorEmail}`);

    // Update cooldown cache
    lastSentCache.set(studentId, now);

  } catch (err) {
    console.error('[Summary] Error generating/sending chat summary:', err.message);
  }
}

module.exports = {
  sendChatSummaryToCounsellor
};
