const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { generateCounselingResponse } = require('../services/aiService');
const { verifyToken } = require('./auth');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true' || Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER || 'apikey',
    pass: process.env.EMAIL_PASS || process.env.SENDGRID_API_KEY
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple in-memory rate limiter: max 20 messages per IP per minute
const rateLimitMap = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

function rateLimit(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_WINDOW_MS;
  }

  record.count++;
  rateLimitMap.set(ip, record);

  if (record.count > RATE_LIMIT) {
    return res.status(429).json({
      error: 'You are sending messages too quickly. Please wait a moment before trying again.',
    });
  }

  next();
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

// ─────────────────────────────────────────────
// ASYNC SENTIMENT ANALYSIS
// ─────────────────────────────────────────────
async function analyzeAndLogSentiment(userId, sessionId, userMessage) {
  if (!userId || !sessionId || !process.env.GROQ_API_KEY) return;
  
  try {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    // Request raw JSON from Groq
    const completion = await groq.chat.completions.create({
      model: 'llama3-8b-8192', // using smaller, faster model
      response_format: { type: 'json_object' },
      messages: [
        { 
          role: 'system', 
          content: 'You are a psychological sentiment analyzer. Analyze the user message and output JSON only with exactly two keys: "score" (number from 1 to 10, where 1=Crisis, 3=Distressed, 6=Neutral, 10=Positive) and "label" (string: exactly one of "positive", "neutral", "distressed", "crisis").'
        },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.1,
      max_tokens: 50,
    });
    
    const resultText = completion.choices[0].message.content;
    const result = JSON.parse(resultText);
    
    if (result.score && result.label) {
      await supabase.from('mood_logs').insert({
        user_id: userId,
        session_id: sessionId,
        score: parseInt(result.score, 10),
        label: result.label.toLowerCase()
      });
      console.log(`🧠 Logged sentiment for ${userId}: ${result.label} (${result.score})`);
    }
  } catch (error) {
    console.warn('⚠️ Sentiment analysis failed:', error.message);
  }
}

// ─────────────────────────────────────────────
// POST /api/chat
// Main chat endpoint — responds with AI counselling message
// ─────────────────────────────────────────────
router.post('/', rateLimit, async (req, res) => {
  try {
    const { message, history: frontendHistory } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message is too long. Please keep it under 2000 characters.' });
    }

    // Attempt to extract userId from headers if verified
    let authHeader = req.headers.authorization;
    let userFromToken = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userFromToken = decoded;
      } catch (err) {
        // invalid token, treat as anonymous
      }
    }

    const userId = userFromToken?.userId || userFromToken?.id || null;

    let dbHistory = [];
    let sessionId = null;

    // 1. Fetch persistent history from sessions table if logged in
    if (userId) {
      const { data: sessionData, error: sessionFetchError } = await supabase
        .from('sessions')
        .select('id, messages')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sessionData) {
        sessionId = sessionData.id;
        dbHistory = Array.isArray(sessionData.messages) ? sessionData.messages : [];
      } else if (sessionFetchError && sessionFetchError.code !== 'PGRST116') {
        console.warn('Could not fetch existing session:', sessionFetchError);
      }
    }

    // 2. Select last 10 exchanges (20 total messages) for AI context
    const recentDbHistory = dbHistory.slice(-20);
    
    // If we have DB history, format it. Otherwise fallback to frontendHistory
    let contextMessages = [];
    if (recentDbHistory.length > 0) {
      contextMessages = recentDbHistory.map(m => ({
        role: m.role, // 'user' or 'assistant'
        text: m.content
      }));
    } else if (Array.isArray(frontendHistory)) {
      contextMessages = frontendHistory.slice(-20);
    }

    // 3. Generate AI Response
    const aiResponseText = await generateCounselingResponse(userId || 'anonymous', message.trim(), contextMessages);

    // 4. Update memory in Supabase
    if (userId) {
      const newUserMessage = {
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString()
      };
      
      const newBotMessage = {
        role: 'assistant',
        content: aiResponseText,
        timestamp: new Date().toISOString()
      };

      const updatedMessages = [...dbHistory, newUserMessage, newBotMessage];

      if (sessionId) {
        // Update existing session
        const { error: updateError } = await supabase
          .from('sessions')
          .update({ messages: updatedMessages })
          .eq('id', sessionId);
          
        if (updateError) console.error('Session update error:', updateError);
      } else {
        // Create new session
        const { data: newSession, error: insertError } = await supabase
          .from('sessions')
          .insert({
            user_id: userId,
            messages: updatedMessages,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();
          
        if (insertError) console.error('Session insert error:', insertError);
        if (newSession) sessionId = newSession.id;
      }

      // 5. Async Mood Analysis (Runs in background)
      if (sessionId) {
        analyzeAndLogSentiment(userId, sessionId, message.trim()).catch(err => 
          console.warn('Background sentiment analysis failed:', err)
        );
      }
    }

    return res.json({ reply: aiResponseText });
  } catch (error) {
    console.error('AI Chat Route Error:', error.message);
    res.status(500).json({
      error: "I'm having a small technical difficulty. Please try again in a moment — I'm here for you. 💙",
    });
  }
});

// ─────────────────────────────────────────────
// POST /api/chat/crisis-log
// Endpoint to log client-side crisis detection and alert admin
// ─────────────────────────────────────────────
router.post('/crisis-log', verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!message) return res.status(400).json({ error: 'Message payload required' });

    // 1. Log to database
    const { error: dbError } = await supabase.from('crisis_flags').insert({
      user_id: userId,
      message: message
    });

    if (dbError) {
      console.error('Crisis log DB error:', dbError);
    }

    // 2. Fetch User Email to trace
    const { data: user } = await supabase.from('users').select('email').eq('id', userId).single();
    
    // 3. Send email to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@counselling.college.edu';
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: adminEmail,
      subject: `URGENT: Crisis Keyword Detected in AI Chat`,
      html: `
        <div style="font-family: Arial, sans-serif; border: 2px solid #e74c3c; padding: 20px; border-radius: 8px;">
          <h2 style="color: #e74c3c;">Critical Alert: Self-Harm/Crisis Intent Detected</h2>
          <p><strong>Student ID / Token:</strong> ${userId}</p>
          <p><strong>Student Email:</strong> ${user?.email || 'Anonymous'}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <div style="background: #f5f7fa; padding: 15px; margin-top: 15px; border-left: 4px solid #e74c3c;">
            <strong>Flagged Message:</strong><br/>
            "${message}"
          </div>
          <p style="margin-top: 20px;">Please check the admin insights dashboard or student profile immediately. The student has been shown the emergency helpline intervention card.</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('🚨 Admin crisis email sent successfully.');
    } catch (mailErr) {
      console.error('Failed to send admin crisis email:', mailErr);
    }

    res.json({ success: true, message: 'Crisis successfully logged and reported.' });
  } catch (error) {
    console.error('Crisis log endpoint error:', error);
    res.status(500).json({ error: 'Server error parsing crisis' });
  }
});

module.exports = router;