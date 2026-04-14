const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

/**
 * Generate a counselling response using Groq (llama-3.3-70b-versatile).
 * Falls back to smart mock responses if no API key is configured.
 */
async function generateCounselingResponse(userId, userMessage, contextMessages = []) {
  if (!process.env.GROQ_API_KEY) {
    console.warn('GROQ_API_KEY not set — using mock responses.');
    return getMockResponse(userMessage);
  }

  try {
    const formattedHistory = contextMessages.map(msg => ({
      role: msg.role === 'bot' ? 'assistant' : 'user',
      content: msg.text,
    }));

    const chatCompletion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a supportive, empathetic, and professional counselling assistant for college students.
Your goal is to provide a safe, non-judgmental space.
- Listen actively and validate feelings.
- Do NOT provide medical diagnoses.
- Offer gentle coping strategies (breathing, grounding, journaling) when appropriate.
- If the user implies self-harm or a severe crisis, compassionately urge them to seek emergency professional help.
- Keep responses warm, concise, and conversational (2-4 sentences max unless more detail is needed).`,
        },
        ...formattedHistory,
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    return chatCompletion.choices[0].message.content;
  } catch (error) {
    console.error('Groq AI Service Error:', error.message);
    // Don't crash — fall back to a helpful mock response
    return getMockResponse(userMessage);
  }
}

/**
 * Smart fallback responses when API is unavailable.
 */
function getMockResponse(message) {
  const msg = message.toLowerCase();

  if (msg.includes('self-harm') || msg.includes('suicide') || msg.includes('end my life') || msg.includes('kill myself')) {
    return "I'm really concerned about what you've shared. Please reach out to a crisis line immediately — iCall at 9152987821 (India) is available to help. You don't have to face this alone, and professional support is just a call away.";
  }
  if (msg.includes('stress') || msg.includes('stressed') || msg.includes('overwhelm')) {
    return "I hear you — feeling overwhelmed is really tough. Try taking 5 slow deep breaths right now: inhale for 4 counts, hold for 4, exhale for 4. Would you like to talk about what's been causing you stress?";
  }
  if (msg.includes('anxious') || msg.includes('anxiety') || msg.includes('panic') || msg.includes('worried')) {
    return "Anxiety can feel so consuming. You're safe right now. A grounding technique that often helps: name 5 things you can see, 4 you can touch, 3 you can hear. Would you like to share more about what's on your mind?";
  }
  if (msg.includes('lonely') || msg.includes('alone') || msg.includes('isolated')) {
    return "Feeling lonely can be really painful, especially in a busy college environment. I'm here with you right now. What's been making you feel this way — is it a specific situation or has it been building for a while?";
  }
  if (msg.includes('sleep') || msg.includes('insomnia') || msg.includes('can\'t sleep')) {
    return "Poor sleep takes a real toll on everything. A few things that help: avoid screens 30 minutes before bed, keep a consistent sleep time, and try writing down tomorrow's worries so your mind can rest. Would you like more sleep tips?";
  }
  if (msg.includes('sad') || msg.includes('depressed') || msg.includes('unhappy') || msg.includes('cry')) {
    return "I'm sorry you're feeling this way — your feelings are completely valid. Sometimes it helps to just let yourself feel it rather than push it away. I'm here to listen. Can you tell me more about what's been going on?";
  }
  if (msg.includes('angry') || msg.includes('frustrated') || msg.includes('mad')) {
    return "It sounds like you're feeling really frustrated right now. That's completely understandable. Would it help to talk through what happened, or would you prefer some quick techniques to cool down?";
  }
  if (msg.includes('exam') || msg.includes('study') || msg.includes('fail') || msg.includes('grade')) {
    return "Academic pressure can feel crushing. Remember: one exam or grade doesn't define your worth or future. Let's break it down — what specifically is worrying you most right now?";
  }
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return "Hello! I'm here to listen and support you. How are you feeling today? Feel free to share whatever's on your mind — there's no judgment here.";
  }
  return "I'm here for you and I'm listening. Can you tell me a little more about how you're feeling right now? I want to make sure I understand what you're going through.";
}

module.exports = {
  generateCounselingResponse,
};
