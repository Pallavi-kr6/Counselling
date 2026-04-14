import React, { useState, useRef, useEffect } from 'react';
import { sendCounsellingMessage } from '../utils/aiBot';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiMessageCircle, FiHeart, FiTrash2, FiWind, FiMenu, FiAlertTriangle, FiPhoneCall } from 'react-icons/fi';
import api from '../utils/api';
import './AICounselling.css';

const AICounselling = () => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('aiCounsellingChat');
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCrisis, setIsCrisis] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('aiCounsellingChat', JSON.stringify(messages));
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading || isCrisis) return;

    const userText = input.trim();
    const userMessage = { role: 'user', text: userText, id: Date.now() };

    const lowerText = userText.toLowerCase();
    const crisisKeywords = [
      "end my life", "don't want to be here", "hurt myself", "kill myself", 
      "suicide", "better off dead", "end it all", "no point in living"
    ];
    
    if (crisisKeywords.some(kw => lowerText.includes(kw))) {
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setIsCrisis(true);
      try {
        await api.post('/chat/crisis-log', { message: userText });
      } catch (err) {
        console.error('Failed to log crisis', err);
      }
      return; // Stop API call entirely
    }
    
    const currentHistory = [...messages, userMessage];
    setMessages(currentHistory);
    setInput('');
    setError('');
    setLoading(true);

    try {
      // Send last 5 messages as context (max 10 items) to save tokens but retain memory
      const recentHistory = currentHistory.slice(-6).filter(m => m.role !== 'error');
      
      const reply = await sendCounsellingMessage(userText, recentHistory);
      const botMessage = { role: 'bot', text: reply, id: Date.now() + 1 };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      const errorMessage = { role: 'error', text: err.message || "I'm having trouble connecting right now. Can you try again?", id: Date.now() + 1 };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (window.confirm('Would you like to start a fresh conversation? This will clear history.')) {
      setMessages([]);
      localStorage.removeItem('aiCounsellingChat');
    }
  };

  return (
    <div className="ai-counselling-page">
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
          <button className="clear-btn" onClick={clearChat} title="Clear Conversation">
            <FiTrash2 size={18} /> <span>Clear Chat</span>
          </button>
        </header>

        {/* Chat Area */}
        <div className="chat-window">
          <AnimatePresence>
            {messages.length === 0 ? (
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
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`message-wrapper ${msg.role}`}
                  >
                    {msg.role === 'bot' && (
                      <div className="message-avatar bot-avatar"><FiHeart size={14} /></div>
                    )}
                    <div className={`message-bubble ${msg.role}`}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}

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

                {/* Hardcoded Crisis Card Overlay */}
                {isCrisis && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="crisis-intervention-card"
                    style={{ margin: '1rem', padding: '1.5rem', background: '#fee2e2', border: '2px solid #ef4444', borderRadius: '12px', color: '#7f1d1d' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                      <FiAlertTriangle size={28} color="#ef4444" />
                      <h3 style={{ margin: 0, fontSize: '1.2rem' }}>We care about your safety</h3>
                    </div>
                    <p style={{ marginBottom: '1.5rem', lineHeight: '1.5' }}>
                      It sounds like you are going through an incredibly difficult time right now. Please know you are not alone, but it's important you speak to a professional immediately.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <a href="tel:9152987821" className="btn-primary" style={{ background: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                        <FiPhoneCall /> iCall Support: 9152987821
                      </a>
                      <a href="tel:9999666555" className="btn-primary" style={{ background: '#1e293b', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                        <FiPhoneCall /> Vandrevala Foundation: 9999 666 555
                      </a>
                    </div>
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
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message here..."
              disabled={loading}
              className="chat-input"
            />
            <button 
              type="submit" 
              className={`send-btn ${input.trim() ? 'active' : ''}`}
              disabled={loading || !input.trim() || isCrisis}
            >
              <FiSend size={18} />
            </button>
          </form>
          <div className="chat-footer-text">
            For emergencies, please contact <a href="/emergency">professional help</a>.
          </div>
        </div>

      </div>
    </div>
  );
};

export default AICounselling;

