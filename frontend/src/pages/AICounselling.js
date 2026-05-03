import React, { useState, useRef, useEffect } from 'react';
import { sendCounsellingMessage } from '../utils/aiBot';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiMessageCircle, FiHeart, FiTrash2, FiWind, FiMenu, FiAlertTriangle, FiPhoneCall, FiX, FiClock, FiBook, FiExternalLink, FiShield } from 'react-icons/fi';
import { Filter } from 'bad-words';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './AICounselling.css';

// Profanity filter — initialised once at module level (not inside the component)
// so it is not re-created on every render.
const profanityFilter = new Filter();

// ── Crisis keyword list (mirrors crisisService.js on the backend) ──────────
// Keep both lists in sync. The backend is the authoritative source;
// this list allows the frontend to show the intervention card immediately
// WITHOUT waiting for the server round-trip.
const CRISIS_KEYWORDS = [
  'kill myself', 'killing myself', 'want to kill myself', 'going to kill myself',
  'suicide', 'suicidal', 'commit suicide',
  'end my life', 'ending my life', 'take my life', 'taking my life',
  'want to die', 'want to be dead', 'wish i was dead', 'rather be dead',
  "can't go on", 'cannot go on', "don't want to be here",
  'no reason to live', 'no point in living',
  'better off dead', 'better off without me', 'not worth living',
  'life is not worth', 'end it all', 'end everything', 'give up on life',
  'hurt myself', 'hurting myself', 'harm myself', 'harming myself',
  'cut myself', 'cutting myself', 'self harm', 'self-harm',
  'worthless and hopeless', 'no way out', 'there is no way out', 'want to disappear'
];

// ── Idle detection constants ─────────────────────────────────
// All values in milliseconds. Adjust to taste.
const CHECK_IN_DELAY  = 10 * 60 * 1000;   // 10 min → inject soft check-in
const CLOSE_DELAY     =  5 * 60 * 1000;   // +5 min (15 total) → auto-close

const CHECK_IN_MESSAGE = {
  role: 'check-in',
  text: "Hey, still there? I'm here if you need to talk 💙",
  id:   'check-in-bubble',
};

// ── Topic detection — maps user input to a resource category ──
// Returns one of: 'stress' | 'anxiety' | 'relationships' | 'academic' | null
function detectTopic(text) {
  const t = text.toLowerCase();
  if (/\b(exam|test|study|grade|assignment|homework|academic|marks|score|semester|lecture|class|concentrate|focus|procrastinat)\b/.test(t)) return 'academic';
  if (/\b(stress|overwhelm|pressure|burnout|overload|too much|stressed out)\b/.test(t)) return 'stress';
  if (/\b(anxious|anxiety|panic|worry|nervous|scared|fear|dread|overthink)\b/.test(t)) return 'anxiety';
  if (/\b(friend|family|relationship|breakup|lonely|loneliness|social|parent|partner|love|isolation|alone)\b/.test(t)) return 'relationships';
  return null;
}

// ── Suggested Resource Card ────────────────────────────────────
// Rendered below a bot bubble when a matching resource exists.
const TYPE_LABELS = { article: '📄 Article', video: '🎬 Video', exercise: '⚡ Exercise' };
const CAT_COLORS  = {
  stress:        { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.35)',  accent: '#22c55e' },
  anxiety:       { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.35)', accent: '#f59e0b' },
  relationships: { bg: 'rgba(244,114,182,0.1)',border: 'rgba(244,114,182,0.35)',accent: '#f472b6' },
  academic:      { bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.35)', accent: '#38bdf8' },
};

function SuggestedResourceCard({ resource }) {
  if (!resource) return null;
  const link    = resource.content_url || resource.url || '#';
  const colors  = CAT_COLORS[resource.category] || CAT_COLORS.stress;
  const typeLabel = TYPE_LABELS[resource.type] || '📄 Article';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      style={{
        margin:          '6px 0 12px 40px',   // indent under bot avatar
        padding:         '12px 14px',
        borderRadius:    12,
        background:      colors.bg,
        border:          `1px solid ${colors.border}`,
        backdropFilter:  'blur(8px)',
        maxWidth:        360,
      }}
    >
      {/* Header label */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:           6,
        marginBottom:  8,
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color:         colors.accent,
      }}>
        <FiBook size={11} />
        Suggested Resource
      </div>

        {/* Resource info */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 4, lineHeight: 1.4 }}>
        {resource.title}
      </div>
      {resource.description && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
          {resource.description.length > 90
            ? resource.description.slice(0, 87) + '…'
            : resource.description}
        </div>
      )}

      {/* Type badge + CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize:   11, color: colors.accent,
          background: colors.bg, border: `1px solid ${colors.border}`,
          padding: '2px 8px', borderRadius: 20, fontWeight: 600,
        }}>
          {typeLabel}
        </span>
        {link !== '#' && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            4,
              fontSize:       12,
              fontWeight:     600,
              color:          colors.accent,
              textDecoration: 'none',
              padding:        '4px 10px',
              borderRadius:   20,
              background:     `${colors.accent}18`,
              border:         `1px solid ${colors.border}`,
              transition:     'all 0.18s',
            }}
            onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.15)'}
            onMouseOut={e  => e.currentTarget.style.filter = 'brightness(1)'}
          >
            Open <FiExternalLink size={10} />
          </a>
        )}
      </div>
    </motion.div>
  );
}

// ── Consent Screen ───────────────────────────────────────────────────
function ConsentScreen({ onConsent }) {
  const [loading, setLoading] = useState(false);

  const handleAgree = async () => {
    setLoading(true);
    try {
      await api.post('/profiles/student/consent');
      onConsent();
    } catch (error) {
      console.error('Consent error:', error);
      alert('Failed to record consent. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 999,
      background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 24,
          boxShadow: '0 24px 60px rgba(0,0,0,0.1)', maxWidth: 540, padding: '2.5rem', width: '100%'
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)',
          color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem'
        }}>
          <FiShield size={28} />
        </div>
        <h2 style={{ fontSize: '1.8rem', color: '#1e293b', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
          Your Privacy & Data
        </h2>
        <p style={{ color: '#475569', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          Before starting your session, it's important you know how we handle your data to keep this a safe space:
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ marginTop: 2, color: '#3b82f6' }}><FiBook size={18} /></div>
            <div>
              <strong style={{ display: 'block', color: '#1e293b', marginBottom: 2 }}>Secure Storage</strong>
              <span style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5 }}>Your chat transcripts and mood journals are encrypted and securely stored to track your progress over time.</span>
            </div>
          </li>
          <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ marginTop: 2, color: '#ef4444' }}><FiAlertTriangle size={18} /></div>
            <div>
              <strong style={{ display: 'block', color: '#1e293b', marginBottom: 2 }}>Crisis Protection</strong>
              <span style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5 }}>This system detects severe distress. If a crisis is detected, a campus counsellor will be alerted and given access to recent messages to help you. Otherwise, conversations are completely private.</span>
            </div>
          </li>
          <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ marginTop: 2, color: '#8b5cf6' }}><FiTrash2 size={18} /></div>
            <div>
              <strong style={{ display: 'block', color: '#1e293b', marginBottom: 2 }}>Right to Delete</strong>
              <span style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5 }}>You own your data. You can withdraw your consent at any time via your Profile settings, which will permanently anonymise your data and clear your history.</span>
            </div>
          </li>
        </ul>

        <button
          onClick={handleAgree}
          disabled={loading}
          style={{
            width: '100%', background: '#1e293b', color: '#fff', border: 'none', padding: '1rem',
            borderRadius: 12, fontSize: '1.05rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s', opacity: loading ? 0.8 : 1
          }}
          onMouseOver={e => !loading && (e.currentTarget.style.background = '#0f172a')}
          onMouseOut={e => !loading && (e.currentTarget.style.background = '#1e293b')}
        >
          {loading ? 'Confirming...' : 'I Understand & Agree'}
        </button>
      </motion.div>
    </div>
  );
}

const AICounselling = () => {
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem('aiCounsellingChat');
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCrisis, setIsCrisis] = useState(false);
  const [profanityWarning, setProfanityWarning] = useState(false);
  const [warningsCount, setWarningsCount] = useState(0);
  const [isSessionClosed, setIsSessionClosed] = useState(false);
  const [preChatMoodDone, setPreChatMoodDone] = useState(false);
  const [submittingMood, setSubmittingMood] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [hasConsented, setHasConsented] = useState(null); // null = checking, true = yes, false = no
  const { user } = useAuth();
  const chatEndRef       = useRef(null);

  // Fetch consent status on mount
  useEffect(() => {
    const checkConsent = async () => {
      try {
        const res = await api.get(`/profiles/student/${user?.id || 'me'}/consent`);
        setHasConsented(!!res.data.consent);
      } catch (err) {
        console.error('Failed to check consent:', err);
        setHasConsented(false); // default to ask
      }
    };
    if (user) {
      checkConsent();
    }
  }, [user]);

  // Time check (9am - 5pm, Mon-Fri)
  const now = new Date();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const isBusinessHours = !isWeekend && now.getHours() >= 9 && now.getHours() < 17;
  const isAfterHours = !isBusinessHours;

  // Idle-timer refs — using refs instead of state avoids stale-closure issues
  // and prevents unnecessary re-renders on every activity reset.
  const checkInTimerRef  = useRef(null);
  const closeTimerRef    = useRef(null);
  const checkInSentRef   = useRef(false);  // prevent duplicate check-in bubbles
  const chatHistoryRef = useRef(chatHistory); // always-current messages snapshot

  // Keep messagesRef in sync so timer callbacks can read current messages
  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem('aiCounsellingChat', JSON.stringify(chatHistory));
    scrollToBottom();
  }, [chatHistory, loading]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Idle timer helpers ───────────────────────────────────────
  const clearIdleTimers = () => {
    clearTimeout(checkInTimerRef.current);
    clearTimeout(closeTimerRef.current);
  };

  const startCloseCountdown = () => {
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setIsSessionClosed(true);
    }, CLOSE_DELAY);
  };

  const resetIdleTimer = () => {
    // Only run idle timer mid-conversation (≥1 message)
    if (chatHistoryRef.current.length === 0) return;

    clearIdleTimers();
    checkInSentRef.current = false;

    checkInTimerRef.current = setTimeout(() => {
      // Guard: only inject if not already closed and no duplicate
      if (checkInSentRef.current) return;
      checkInSentRef.current = true;

      setChatHistory(prev => {
        // Don't add a second check-in if one already exists
        if (prev.some(m => m.role === 'check-in')) return prev;
        return [...prev, { ...CHECK_IN_MESSAGE, id: `check-in-${Date.now()}` }];
      });

      startCloseCountdown();
    }, CHECK_IN_DELAY);
  };

  // Start idle timer whenever messages change (new message resets it)
  useEffect(() => {
    if (isSessionClosed) return;
    resetIdleTimer();
    return clearIdleTimers; // cleanup on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory.length, isSessionClosed]);

  // Reset on tab/window focus (user returned)
  useEffect(() => {
    const onFocus = () => { if (!isSessionClosed) resetIdleTimer(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionClosed]);

  const handlePreChatMood = async (score) => {
    setSubmittingMood(true);
    try {
      await api.post('/chat/pre-chat-mood', { moodScore: score, isAnonymous });
    } catch (e) {
      console.warn('Pre-chat mood log failed:', e.message);
    } finally {
      setSubmittingMood(false);
      setPreChatMoodDone(true);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading || isSessionClosed) return;

    // Any send counts as activity — reset idle timer and strip check-in bubble
    setChatHistory(prev => prev.filter(m => m.role !== 'check-in'));
    checkInSentRef.current = false;
    resetIdleTimer();

    const userText = input.trim();

    // ── Profanity gate (runs first — nothing is logged or forwarded) ─────
    if (profanityFilter.isProfane(userText)) {
      setProfanityWarning(true);
      const newCount = warningsCount + 1;
      setWarningsCount(newCount);
      
      // If 3 strikes reached, log a soft alert to the database
      if (newCount === 3) {
        api.post('/chat/soft-alert', { message: userText })
          .catch(err => console.warn('Soft alert log failed:', err.message));
      }
      return; // Hard stop
    }
    setProfanityWarning(false);

    const userMessage = { role: 'user', content: userText, id: Date.now() };
    const lowerText   = userText.toLowerCase();

    // ── Client-side crisis pre-check (instant UX) ─────────────────────────
    const clientCrisis = CRISIS_KEYWORDS.some(kw => lowerText.includes(kw));

    if (clientCrisis) {
      setChatHistory(prev => [...prev, userMessage]);
      setInput('');
      setIsCrisis(true);
      // Fire to backend; pass alreadyHandled=false so the server logs it.
      api.post('/chat/crisis-log', { message: userText, alreadyHandled: false, isAnonymous })
        .catch(err => console.warn('Crisis log failed:', err.message));
      return;
    }

    // ── Normal flow ────────────────────────────────────────────────────────
    const currentHistory = [...chatHistory, userMessage];
    setChatHistory(currentHistory);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const recentHistory = currentHistory.slice(-6).filter(m => m.role !== 'error');
      const reply = await sendCounsellingMessage(userText, recentHistory, isAnonymous);

      // ── Handle server-side crisis detection ───────────────────────────
      // The backend returns crisisDetected:true when it catches a keyword
      // the frontend missed (e.g., subtle phrasing added to the keywords list).
      if (reply?.crisisDetected) {
        setIsCrisis(true);
        // Server already logged the alert, so pass alreadyHandled=true
        api.post('/chat/crisis-log', { message: userText, alreadyHandled: true, isAnonymous })
          .catch(() => {});
      }

      const replyText  = typeof reply === 'string' ? reply : reply?.reply || reply?.text || '';
      const botId      = Date.now() + 1;
      const botMessage = { role: 'bot', content: replyText, id: botId, suggestedResource: null };
      setChatHistory(prev => [...prev, botMessage]);

      // ── Non-blocking resource suggestion ──────────────────────────────
      // Detect topic from the user's words; fetch one matching resource and
      // patch it into the existing bot message without re-rendering the chat.
      const topic = detectTopic(userText);
      if (topic) {
        api.get(`/resources/suggest?topic=${encodeURIComponent(topic)}`)
          .then(res => {
            if (res.data?.resource) {
              setChatHistory(prev => prev.map(m =>
                m.id === botId ? { ...m, suggestedResource: res.data.resource } : m
              ));
            }
          })
          .catch(() => {}); // silently ignore — card is an enhancement only
      }
    } catch (err) {
      const errorMessage = {
        role: 'error',
        content: err.message || "I'm having trouble connecting right now. Can you try again?",
        id: Date.now() + 1,
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (window.confirm('Would you like to start a fresh conversation? This will clear history.')) {
      clearIdleTimers();
      checkInSentRef.current = false;
      setIsSessionClosed(false);
      setChatHistory([]);
      localStorage.removeItem('aiCounsellingChat');
    }
  };

  return (
    <div className="ai-counselling-page" style={{ position: 'relative' }}>
      {hasConsented === false && (
        <ConsentScreen onConsent={() => setHasConsented(true)} />
      )}
      <div className="chat-container">
        
        {/* Header Section */}
        <header className="chat-header">
          <div className="chat-header-profile">
            <div className="chat-avatar">
              <FiHeart size={24} />
            </div>
            <div className="chat-info">
              <h1>Counselling Assistant</h1>
              <p>Your secure & safe space</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#64748b', marginRight: '1rem', cursor: 'pointer', background: '#f1f5f9', padding: '6px 12px', borderRadius: '20px' }}>
              <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} />
              Anonymous
            </label>
            <button className="clear-btn" onClick={clearChat} title="Clear Conversation">
              <FiTrash2 size={18} /> <span>Clear Chat</span>
            </button>
          </div>
        </header>

        {isAnonymous && (
          <div style={{ background: '#f8fafc', padding: '6px 16px', fontSize: '0.75rem', color: '#64748b', textAlign: 'center', borderBottom: '1px solid #e2e8f0', letterSpacing: '0.5px' }}>
            <FiShield style={{ marginRight: '6px' }} /> Anonymous mode — your identity is not stored.
          </div>
        )}

        {isAfterHours && (
          <div style={{ background: '#fef2f2', padding: '10px 16px', fontSize: '0.85rem', color: '#991b1b', borderBottom: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiAlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>Counsellors are offline — but I'm here. For emergencies call iCall: <strong>9152987821</strong>.</span>
          </div>
        )}


        {/* Chat Area */}
        <div className="chat-window">
          <AnimatePresence>
            {!preChatMoodDone && chatHistory.length === 0 ? (
              <motion.div
                initial={{ opacity:0, scale:0.95 }}
                animate={{ opacity:1, scale:1 }}
                exit={{ opacity:0, y:-20 }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', gap: '1rem',
                  padding: '2rem', textAlign: 'center', background: '#f8fafc'
                }}
              >
                <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '50%', marginBottom: '8px' }}>
                  <FiHeart size={32} color="#3b82f6" />
                </div>
                <h3 style={{ margin:0, color: '#1e293b', fontSize: '1.25rem' }}>How are you feeling right now?</h3>
                <p style={{ margin:0, color: '#64748b', fontSize: '0.9rem', maxWidth:'300px' }}>
                  Choose the emoji that best reflects your current mood to start the session.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  {[
                    { score: 1, emoji: '😔', label: 'Very Low' },
                    { score: 2, emoji: '😟', label: 'Low' },
                    { score: 3, emoji: '😐', label: 'Neutral' },
                    { score: 4, emoji: '🙂', label: 'Good' },
                    { score: 5, emoji: '😄', label: 'Great' }
                  ].map(item => (
                    <button
                      key={item.score}
                      disabled={submittingMood}
                      onClick={() => handlePreChatMood(item.score)}
                      style={{
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius:'12px',
                        padding: '12px 16px', fontSize: '2rem', cursor: submittingMood ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        opacity: submittingMood ? 0.6 : 1
                      }}
                      onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                      title={item.label}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : chatHistory.length === 0 ? (
              <motion.div 
                className="chat-empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="empty-icon-wrap">
                  <FiWind size={36} />
                </div>
                <h2>How are you feeling today?</h2>
                <p>Take a deep breath and share whatever is on your mind. I am here to listen without judgment.</p>
                
                <div className="suggestion-chips">
                  {["I feel stressed", "I am feeling anxious", "I need to vent", "I can't sleep"].map((s, i) => (
                    <button key={i} onClick={() => setInput(s)} className="chip-btn">
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="messages-list">
                {chatHistory.map((msg) => {
                  // ── Check-in bubble — distinct centered style ──────────
                  if (msg.role === 'check-in') {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="message-wrapper check-in"
                      >
                        <div className="check-in-bubble">
                          <FiClock size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
                          <span>{msg.content || msg.text}</span>
                        </div>
                      </motion.div>
                    );
                  }

                  // ── Standard message bubbles ───────────────────────────
                  return (
                    <React.Fragment key={msg.id}>
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`message-wrapper ${msg.role}`}
                      >
                        {msg.role === 'bot' && (
                          <div className="message-avatar bot-avatar"><FiHeart size={14} /></div>
                        )}
                        <div className={`message-bubble ${msg.role}`}>
                          {msg.content || msg.text}
                        </div>
                      </motion.div>
                      {msg.role === 'bot' && msg.suggestedResource && (
                        <SuggestedResourceCard resource={msg.suggestedResource} />
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Loading indicator */}
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="message-wrapper bot"
                  >
                    <div className="message-avatar bot-avatar"><FiHeart size={14} /></div>
                    <div className="message-bubble bot typing-bubble">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </div>
                  </motion.div>
                )}

                {/* Crisis Intervention Card */}
                {isCrisis && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="crisis-intervention-card"
                    style={{
                      margin: '1rem',
                      padding: '1.5rem',
                      background: 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)',
                      border: '2px solid #ef4444',
                      borderRadius: '16px',
                      color: '#7f1d1d',
                      boxShadow: '0 8px 32px rgba(239,68,68,0.15)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <FiAlertTriangle size={28} color="#ef4444" />
                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>We care about your safety</h3>
                      </div>
                      <button
                        onClick={() => setIsCrisis(false)}
                        title="Dismiss and continue chatting"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#ef4444', padding: '4px', borderRadius: '50%',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <FiX size={20} />
                      </button>
                    </div>
                    <p style={{ marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '0.95rem' }}>
                      It sounds like you are going through an incredibly difficult time right now.
                      Please know you are <strong>not alone</strong> — but it's important you speak
                      to a professional immediately.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <a
                        href="tel:9152987821"
                        style={{
                          background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px',
                          padding: '12px 16px', display: 'flex', alignItems: 'center',
                          gap: '0.6rem', justifyContent: 'center', textDecoration: 'none',
                          fontWeight: 600, fontSize: '0.9rem',
                        }}
                      >
                        <FiPhoneCall /> iCall Support: 9152987821
                      </a>
                      <a
                        href="tel:9999666555"
                        style={{
                          background: '#1e293b', color: '#fff', border: 'none', borderRadius: '10px',
                          padding: '12px 16px', display: 'flex', alignItems: 'center',
                          gap: '0.6rem', justifyContent: 'center', textDecoration: 'none',
                          fontWeight: 600, fontSize: '0.9rem',
                        }}
                      >
                        <FiPhoneCall /> Vandrevala Foundation: 9999 666 555
                      </a>
                      <a
                        href="tel:14416"
                        style={{
                          background: '#0f766e', color: '#fff', border: 'none', borderRadius: '10px',
                          padding: '12px 16px', display: 'flex', alignItems: 'center',
                          gap: '0.6rem', justifyContent: 'center', textDecoration: 'none',
                          fontWeight: 600, fontSize: '0.9rem',
                        }}
                      >
                        <FiPhoneCall /> Snehi Helpline: 044-24640050
                      </a>
                    </div>
                    <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#991b1b', textAlign: 'center' }}>
                      A counsellor has been notified and will reach out to you. ❤️
                    </p>
                  </motion.div>
                )}

                <div ref={chatEndRef} />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          <form className="chat-form" onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (profanityWarning) setProfanityWarning(false);
                // Typing counts as activity — strip check-in and reset timer
                if (chatHistoryRef.current.some(m => m.role === 'check-in')) {
                  setChatHistory(prev => prev.filter(m => m.role !== 'check-in'));
                  checkInSentRef.current = false;
                  resetIdleTimer();
                }
              }}
              placeholder={!preChatMoodDone && chatHistory.length === 0 ? 'Select a mood above to start' : isSessionClosed ? 'Session closed — clear chat to start again' : 'Type your message here...'}
              disabled={loading || isSessionClosed || (!preChatMoodDone && chatHistory.length === 0)}
              className={`chat-input${profanityWarning ? ' chat-input--warn' : ''}${isSessionClosed ? ' chat-input--closed' : ''}`}
            />
            <button 
              type="submit" 
              className={`send-btn ${input.trim() && !isSessionClosed && preChatMoodDone ? 'active' : ''}`}
              disabled={loading || !input.trim() || isCrisis || isSessionClosed || (!preChatMoodDone && chatHistory.length === 0)}
            >
              <FiSend size={18} />
            </button>
          </form>

          {/* Profanity warning — inline, no log, no API call */}
          <AnimatePresence>
            {profanityWarning && (
              <motion.div
                key="profanity-warn"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  margin: '6px 4px 0',
                  padding: '8px 12px',
                  background: '#fff7ed',
                  border: '1px solid #fb923c',
                  borderRadius: '8px',
                  color: '#9a3412',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                }}
                role="alert"
                aria-live="polite"
              >
                <FiAlertTriangle size={14} color="#eab308" style={{ flexShrink: 0 }} />
                Let's keep this space respectful — try rephrasing that.
              </motion.div>
            )}
          </AnimatePresence>

          <div className="chat-footer-text">
            For emergencies, please contact <a href="/emergency">professional help</a>.
          </div>
        </div>


      </div>
    </div>
  );
};

export default AICounselling;

