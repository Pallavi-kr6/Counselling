const Groq = require('groq-sdk');

const SYSTEM_PROMPT = `You are a warm, empathetic counselling assistant for college students. You are having a real back-and-forth conversation — NOT delivering scripted therapy lines.

STRICT RULES:
1. Read the ENTIRE conversation history above before responding. Reference what the user has already told you.
2. NEVER repeat a response you already gave in this conversation. Check the history.
3. If the user already told you what is stressing them, DO NOT ask them again what is causing stress.
4. Validate emotions first, then respond to the SPECIFIC thing they said.
5. Keep responses to 2-3 sentences max. Ask only ONE follow-up question.
6. Remember the user's name, subjects, problems — anything they share.
7. Sound like a caring friend, not a helpline script.
8. NEVER diagnose. NEVER give medical advice.`;

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
  'llama3-8b-8192',
];

async function tryGroq(messages) {
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY is not set in environment variables!');
    return null;
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  for (const model of GROQ_MODELS) {
    try {
      console.log(`🔄 Trying Groq model: ${model}`);
      const res = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.75,
        max_tokens: 300,
        frequency_penalty: 0.6,
      });
      const reply = res.choices[0].message.content;
      console.log(`✅ Groq success with model: ${model}`);
      console.log(`📤 Reply preview: ${reply.slice(0, 80)}...`);
      return reply;
    } catch (err) {
      // Log the FULL error so you can see what's actually failing
      console.error(`❌ Groq model ${model} failed:`, err.message);
      if (err.status) console.error(`   HTTP Status: ${err.status}`);
      if (err.error) console.error(`   Error detail:`, JSON.stringify(err.error));
    }
  }

  console.error('❌ ALL Groq models failed. Check your API key and network.');
  return null;
}

async function generateCounselingResponse(userId, userMessage, contextMessages = []) {
  // Normalize history — ensure only valid roles reach Groq
  const formattedHistory = contextMessages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'bot')
    .map(msg => ({
      role: msg.role === 'bot' ? 'assistant' : msg.role,
      content: msg.content || '',
    }))
    .filter(msg => msg.content.trim() !== '');

  // Crisis check — hardcoded safety net before any API call
  const lowerMsg = userMessage.toLowerCase();
  const crisisKeywords = ['suicide', 'kill myself', 'end my life', 'want to die', 'harm myself', 'self-harm', 'cut myself'];
  if (crisisKeywords.some(kw => lowerMsg.includes(kw))) {
    return "I'm deeply concerned about what you're sharing. Your safety is the absolute priority right now. Please speak to your counselor immediately or call iCall at 9152987821. You do not have to go through this alone.";
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...formattedHistory,
    { role: 'user', content: userMessage },
  ];

  console.log(`📨 Sending to Groq — history length: ${formattedHistory.length} messages`);

  const groqReply = await tryGroq(messages);

  if (groqReply) return groqReply;

  // If Groq genuinely failed, return an honest error message
  // NOT a fake scripted response that hides the real problem
  console.error('⚠️ Groq unavailable — returning error message to user');
  return "I'm having a little trouble connecting right now. Please try again in a moment — I'm here for you. 💙";
}

module.exports = { generateCounselingResponse };
