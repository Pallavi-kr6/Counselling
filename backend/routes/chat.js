const express = require('express');
const router = express.Router();
const { generateCounselingResponse } = require('../services/aiService');

router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    // Default to an empty array if frontend didn't pass history
    const conversationHistory = Array.isArray(history) ? history : [];

    // The user identity should ideally come from our auth middleware (req.user), 
    // but we can pass 'anonymous' if they are doing it without logging in context.
    const userId = req.user?.id || 'anonymous';

    // Call service to get response
    const aiResponseText = await generateCounselingResponse(userId, message, conversationHistory);
    
    return res.json({ reply: aiResponseText });
  } catch (error) {
    console.error('AI Chat Route Error:', error.message);
    // Generic fallback or error to the user
    res.status(500).json({ error: 'Failed to communicate with AI service. I am here for you, please try sending your message again.' });
  }
});

module.exports = router;