const express = require('express');
const router = express.Router();
const { generateCounselingResponse } = require('../services/aiService');

// Simple in-memory rate limiter: max 20 messages per IP per minute
const rateLimitMap = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

function rateLimit(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };

  // Reset window if expired
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

router.post('/', rateLimit, async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message is too long. Please keep it under 2000 characters.' });
    }

    // Use last 10 messages max to keep context without burning tokens
    const conversationHistory = Array.isArray(history) ? history.slice(-10) : [];
    const userId = req.user?.id || 'anonymous';

    const aiResponseText = await generateCounselingResponse(userId, message.trim(), conversationHistory);

    return res.json({ reply: aiResponseText });
  } catch (error) {
    console.error('AI Chat Route Error:', error.message);
    res.status(500).json({
      error: "I'm having a small technical difficulty. Please try again in a moment — I'm here for you. 💙",
    });
  }
});

module.exports = router;