const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { generateCounselingResponse } = require('../services/aiService');
const { handleCrisisIfDetected } = require('../services/crisisService');
const { verifyToken } = require('./auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function authenticateOptional(req, res, next) {
  const authHeader = req.headers.authorization;
  req.user = null;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Accommodate different token structures
    req.user = {
      userId: decoded.userId || decoded.id,
      email: decoded.email,
      userType: decoded.userType
    };
  } catch (err) {
    // Ignored, anonymous behavior proceeds
  }
  next();
}

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
    const { message, previousHistory: frontendHistory, isAnonymous } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message needed to proceed.' });
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

    let userId = userFromToken?.userId || userFromToken?.id || null;

    if (isAnonymous) {
      userId = null;
      userFromToken = null;
    }

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

    // 3. Server-side crisis scan — runs BEFORE AI (catches any message the frontend missed)
    const studentEmail = userFromToken?.email || null;
    const { detected: crisisDetected, matched: crisisMatched, alertId, transcriptId } =
      await handleCrisisIfDetected({
        message: message.trim(),
        studentId: userId,
        studentEmail,
        sessionId,   // ← pass the resolved sessionId for accurate history lookup
      });

    // 4. Generate AI Response
    const aiResponseText = await generateCounselingResponse(userId || 'anonymous', message.trim(), contextMessages);

    // 5. Update memory in Supabase
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

      // 6. Async Mood Analysis (Runs in background)
      if (sessionId) {
        analyzeAndLogSentiment(userId, sessionId, message.trim()).catch(err => 
          console.warn('Background sentiment analysis failed:', err)
        );
      }
    }

    return res.json({
      reply: aiResponseText,
      // Inform the frontend when a crisis was server-detected (so it can show the intervention card)
      crisisDetected:   crisisDetected  || false,
      crisisAlertId:    alertId         || null,
      crisisTranscriptId: transcriptId  || null,
    });
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
// ─────────────────────────────────────────────
// POST /api/chat/crisis-log
// Called by the frontend when it independently detects a crisis keyword.
// The crisisService handles DB insert + notify — ensuring no duplication
// if the main /api/chat route already handled it server-side.
router.post('/crisis-log', authenticateOptional, async (req, res) => {
  try {
    const { message, alreadyHandled, isAnonymous } = req.body;
    let userId      = req.user?.userId || req.user?.id || null;
    let studentEmail = req.user?.email || null;

    if (isAnonymous) {
      userId = null;
      studentEmail = null;
    }

    if (!message) return res.status(400).json({ error: 'Message payload required' });

    // If the main chat route already handled this (server-side detection),
    // skip re-inserting to avoid duplicate rows — just acknowledge.
    if (alreadyHandled) {
      return res.json({ success: true, message: 'Crisis already logged by server.' });
    }

    // Otherwise run the full crisis pipeline
    const { alertId, matched } = await handleCrisisIfDetected({
      message,
      studentId: userId,
      studentEmail,
    });

    // Also insert into legacy crisis_flags for backwards compatibility
    await supabase.from('crisis_flags').insert({ user_id: userId, message }).catch(() => {});

    res.json({
      success: true,
      message: 'Crisis logged and reported.',
      alertId,
      keywordsMatched: matched,
    });
  } catch (error) {
    console.error('Crisis log endpoint error:', error);
    res.status(500).json({ error: 'Server error parsing crisis' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/chat/soft-alert
// Logs repeated profanity / boundary violations to Supabase.
// This allows counsellors to review flagged users later.
// ─────────────────────────────────────────────────────────────
router.post('/soft-alert', authenticateOptional, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const userId = req.user?.userId || null;

    const { error } = await supabase
      .from('soft_alerts')
      .insert({
        user_id: userId,
        flagged_message: message,
        reason: 'Profanity rules repeatedly violated (>= 3 warnings)',
        reviewed: false,
      });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Soft alert log error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/chat/pre-chat-mood
// Logs the user's initial pre-chat emoji selection (1-5 scale)
// to the mood_logs table as requested.
// ─────────────────────────────────────────────────────────────
router.post('/pre-chat-mood', authenticateOptional, async (req, res) => {
  try {
    const { moodScore, sessionId } = req.body;
    if (!moodScore) return res.status(400).json({ error: 'moodScore required' });

    const userId = req.user?.userId || null;

    const { error } = await supabase
      .from('mood_logs')
      .insert({
        user_id: userId,
        session_id: sessionId || null,
        mood_score: moodScore,  // 1-5 explicitly requested
        label: 'pre-chat check-in',
      });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Pre-chat mood log error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;