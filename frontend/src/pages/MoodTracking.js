import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { motion } from 'framer-motion';
import { LineChart, Line as RechartsLine, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { 
  FiWind, 
  FiMoon, 
  FiEdit3, 
  FiHeart, 
  FiActivity, 
  FiCalendar
} from 'react-icons/fi';
import './MoodTracking.css';



const MoodTracking = () => {
  const [mood, setMood] = useState(5);
  const [stressLevel, setStressLevel] = useState(5);
  const [sleepHours, setSleepHours] = useState(7);
  const [notes, setNotes] = useState('');
  const [emoji, setEmoji] = useState('😐');
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('check-in');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(null);
  const [gentleInsight, setGentleInsight] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);

  const emojis = [
    { icon: '😢', label: 'Struggling', val: 1 },
    { icon: '😔', label: 'Down', val: 3 },
    { icon: '😐', label: 'Okay', val: 5 },
    { icon: '🙂', label: 'Good', val: 7 },
    { icon: '😊', label: 'Great', val: 9 }
  ];

  const stressOptions = [
    { label: 'Calm & Relaxed', val: 2 },
    { label: 'A bit tense', val: 5 },
    { label: 'Overwhelmed', val: 9 }
  ];

  const sleepOptions = [
    { label: 'Needs rest (<5h)', val: 4 },
    { label: 'Okay (6-7h)', val: 7 },
    { label: 'Well rested (8h+)', val: 9 }
  ];

  useEffect(() => {
    fetchMoodHistory();
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (history.length > 0 && !gentleInsight) {
      loadGentleInsight();
    }
  }, [history]);

  const loadGentleInsight = async () => {
    const cachedData = localStorage.getItem('gentleInsightCache');
    const now = Date.now();
    const recent = history.slice(0, 5).reverse();
    const recentEmojis = recent.map(e => e.emoji).join(', ');

    if (cachedData) {
      const { insight, timestamp, moodsList } = JSON.parse(cachedData);
      if (now - timestamp < 6 * 60 * 60 * 1000 && moodsList === recentEmojis) {
        setGentleInsight(insight);
        return;
      }
    }

    if (recent.length === 0) return;

    const emojiMap = {
      '😢': 'Struggling', '😔': 'Down', '😐': 'Okay', '🙂': 'Good', '😊': 'Great'
    };
    
    const moodsStr = recent.map(e => emojiMap[e.emoji] || e.emoji).join(', ');

    try {
      const response = await api.get(`/mood/gentle-insight?moods=${encodeURIComponent(moodsStr)}`);
      const newInsight = response.data.insight;
      setGentleInsight(newInsight);
      
      localStorage.setItem('gentleInsightCache', JSON.stringify({
        insight: newInsight,
        timestamp: now,
        moodsList: recentEmojis
      }));
    } catch (error) {
      console.error('Error fetching gentle insight:', error);
      setGentleInsight("It looks like you've been navigating a mix of feelings. Be gentle with yourself today.");
    }
  };

  const fetchMoodHistory = async () => {
    try {
      const response = await api.get('/mood/history');
      const hist = response.data.history || [];
      setHistory(hist);
      
      const today = new Date().toISOString().split('T')[0];
      const alreadyChecked = hist.some(entry => {
        const entryDate = new Date(entry.date).toISOString().split('T')[0];
        return entryDate === today;
      });
      setHasCheckedInToday(alreadyChecked);
    } catch (error) {
      console.error('Error fetching mood history:', error);
    }
  };

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/mood/dashboard?days=7');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasCheckedInToday) {
      alert('ALREADY CHECKED IN');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/mood/check-in', {
        mood, emoji, stressLevel, sleepHours, notes
      });
      setNotes('');
      fetchMoodHistory();
      fetchDashboard();
      alert('Mood saved successfully!');
    } catch (error) {
      if (error.response?.data?.error === 'ALREADY_CHECKED_IN') {
        alert('ALREADY CHECKED IN');
        setHasCheckedInToday(true);
      } else {
        console.error('Error saving check-in:', error);
        alert('Error saving check-in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const emojiToScore = {
    '😢': 1,
    '😔': 3,
    '😐': 5,
    '🙂': 7,
    '😊': 9
  };

  const rechartsData = (() => {
    if (!history || history.length === 0) return [];
    
    // 1. Group by date string to handle duplicates (only keep last check-in of each day)
    const grouped = history.reduce((acc, entry) => {
      // entry.date is YYYY-MM-DD
      const dateKey = entry.date; 
      if (!acc[dateKey]) {
        acc[dateKey] = entry;
      }
      return acc;
    }, {});

    // 2. Convert to array and sort chronologically (oldest to newest)
    const sortedUniqueDays = Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));

    const emojiToLabel = {
      '😢': 'Struggling',
      '😔': 'Down',
      '😐': 'Okay',
      '🙂': 'Good',
      '😊': 'Great'
    };

    // 3. Take last 7 days and format for Recharts
    return sortedUniqueDays.slice(-7).map(entry => {
      const dateObj = new Date(entry.date);
      return {
        weekday: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: emojiToScore[entry.emoji] || parseInt(entry.mood) || 5,
        emoji: entry.emoji || '😐',
        label: emojiToLabel[entry.emoji] || 'Neutral'
      };
    });
  })();

  const CustomDot = (props) => {
    const { cx, cy, payload, index } = props;
    if (!cx || !cy) return null;
    
    // Only show emoji on actual data points, slightly offset
    return (
      <g key={`dot-${index}`}>
        <circle cx={cx} cy={cy} r={4} fill="#1D9E75" stroke="#fff" strokeWidth={2} />
        <text 
          x={cx} 
          y={cy - 15} 
          fontSize="18" 
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          {payload.emoji}
        </text>
      </g>
    );
  };

  const getMoodColor = (moodVal) => {
    const val = parseInt(moodVal);
    if (val <= 3) return '#ef4444'; // Red
    if (val <= 5) return '#f59e0b'; // Orange
    if (val <= 7) return '#3b82f6'; // Blue
    return '#1D9E75'; // Teal
  };

  const filteredJournal = history.filter(entry => 
    entry.notes && entry.notes.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: "easeOut" } }
  };

  return (
    <motion.div 
      className="mood-tracking"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
    >
      <div className="container" style={{ maxWidth: '1000px' }}>
        <header className="page-header" style={{ textAlign: 'center', margin: '3rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <motion.div variants={itemVariants} style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '1rem', borderRadius: '50%', display: 'inline-flex', marginBottom: '1.5rem' }}>
            <FiHeart size={32} />
          </motion.div>
          <motion.h1 variants={itemVariants} style={{ fontSize: '2.5rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Daily Reflection</motion.h1>
          <motion.p className="subtitle" variants={itemVariants} style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Take a moment for yourself. How is your heart doing today?</motion.p>
        </header>

        <div className="mood-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '2.5rem' }}>
          <motion.div className="mood-card-main glass-card" variants={itemVariants} style={{ padding: '3rem 2.5rem' }}>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '1rem' }}>
              <button 
                type="button"
                onClick={() => setActiveTab('check-in')}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', fontWeight: activeTab === 'check-in' ? '700' : '500', color: activeTab === 'check-in' ? 'var(--primary-dark)' : 'var(--text-secondary)', cursor: 'pointer', position: 'relative' }}
              >
                Daily Check-in
                {activeTab === 'check-in' && <div style={{ position: 'absolute', bottom: '-18px', left: 0, right: 0, height: '4px', background: 'var(--primary)', borderRadius: '4px' }} />}
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('journal')}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', fontWeight: activeTab === 'journal' ? '700' : '500', color: activeTab === 'journal' ? 'var(--primary-dark)' : 'var(--text-secondary)', cursor: 'pointer', position: 'relative' }}
              >
                Journal
                {activeTab === 'journal' && <div style={{ position: 'absolute', bottom: '-18px', left: 0, right: 0, height: '4px', background: 'var(--primary)', borderRadius: '4px' }} />}
              </button>
            </div>

            {activeTab === 'check-in' ? (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '1.1rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '1rem', textAlign: 'center' }}>
                  I'm feeling...
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {emojis.map((em) => (
                    <motion.button
                      key={em.val}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '1.25rem 0.5rem',
                        borderRadius: '20px',
                        border: emoji === em.icon ? '2px solid var(--primary)' : '2px solid transparent',
                        background: emoji === em.icon ? 'var(--primary-light)' : 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                      onClick={() => { setEmoji(em.icon); setMood(em.val); }}
                    >
                      <span style={{ fontSize: '2.5rem', filter: emoji !== em.icon ? 'grayscale(0.5)' : 'none', transition: 'filter 0.3s ease' }}>{em.icon}</span>
                      <span style={{ fontSize: '0.9rem', color: emoji === em.icon ? 'var(--primary-dark)' : 'var(--text-secondary)', fontWeight: emoji === em.icon ? '600' : '400' }}>{em.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                  <FiWind style={{ color: 'var(--secondary)' }} /> My mind feels
                </label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {stressOptions.map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setStressLevel(opt.val)}
                      style={{
                        flex: 1,
                        padding: '1rem',
                        borderRadius: '16px',
                        border: stressLevel === opt.val ? '2px solid var(--secondary)' : '1px solid var(--glass-border)',
                        background: stressLevel === opt.val ? 'var(--secondary-light)' : 'rgba(255,255,255,0.5)',
                        color: stressLevel === opt.val ? '#5b21b6' : 'var(--text-secondary)',
                        fontWeight: stressLevel === opt.val ? '600' : '400',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        minWidth: '120px'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                  <FiMoon style={{ color: 'var(--accent)' }} /> My body is
                </label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {sleepOptions.map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setSleepHours(opt.val)}
                      style={{
                        flex: 1,
                        padding: '1rem',
                        borderRadius: '16px',
                        border: sleepHours === opt.val ? '2px solid var(--accent)' : '1px solid var(--glass-border)',
                        background: sleepHours === opt.val ? 'rgba(147, 197, 253, 0.15)' : 'rgba(255,255,255,0.5)',
                        color: sleepHours === opt.val ? '#1e3a8a' : 'var(--text-secondary)',
                        fontWeight: sleepHours === opt.val ? '600' : '400',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        minWidth: '120px'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                  <FiEdit3 style={{ color: 'var(--primary)' }} /> Journal (optional)
                </label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="You can write freely here. This space is just for you..."
                  style={{
                    width: '100%',
                    padding: '1.25rem',
                    borderRadius: '20px',
                    border: '1px solid rgba(46, 186, 168, 0.2)',
                    background: 'rgba(255,255,255,0.8)',
                    minHeight: '120px',
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    resize: 'vertical',
                    transition: 'border-color 0.3s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(46, 186, 168, 0.2)'}
                />
              </div>

              <button 
                type="submit" 
                className={`btn btn-primary btn-block ${hasCheckedInToday ? 'disabled' : ''}`} 
                disabled={submitting || hasCheckedInToday} 
                style={{ 
                  padding: '1.25rem', 
                  fontSize: '1.1rem', 
                  borderRadius: '100px',
                  background: hasCheckedInToday ? '#cbd5e1' : 'var(--primary)',
                  cursor: hasCheckedInToday ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? 'Holding space...' : hasCheckedInToday ? 'Already Checked In Today' : 'Save this moment'}
              </button>
              {hasCheckedInToday && (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-1.5rem' }}>
                  You've already shared your heart today. See you tomorrow! 🌷
                </p>
              )}
            </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="Search your journal..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '1rem 1.5rem', borderRadius: '100px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.8)', fontSize: '1rem', outline: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '600px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {filteredJournal.length > 0 ? filteredJournal.map(entry => (
                    <div key={entry.id} style={{ display: 'flex', gap: '1.25rem', padding: '1.5rem', background: 'rgba(255,255,255,0.7)', borderRadius: '1rem', borderTopRightRadius: '1rem', borderBottomRightRadius: '1rem', borderLeft: `6px solid ${getMoodColor(entry.mood)}`, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center' }}>
                        {entry.emoji}
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                        <p style={{ marginTop: '0.5rem', color: 'var(--text-primary)', lineHeight: '1.6', fontSize: '1.05rem' }}>
                          {entry.notes}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No journal entries found. Begin writing your journey in the check-in tab! 💛
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            <motion.div className="glass-card" variants={itemVariants} style={{ padding: '2.5rem', background: 'linear-gradient(135deg, rgba(230, 247, 246, 0.9), rgba(255, 255, 255, 0.95))', border: '1px solid rgba(46, 186, 168, 0.15)' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <FiHeart size={24} style={{ color: 'var(--primary-dark)' }} />
                <h3 style={{ fontSize: '1.2rem', color: 'var(--primary-dark)' }}>Gentle Insight</h3>
              </div>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-primary)', lineHeight: '1.6', fontStyle: 'italic', marginBottom: '1rem' }}>
                "{gentleInsight || 'Gently analyzing your heartspace...'}"
              </p>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                Your average feeling is resting around {stats?.averageMood || 'okay'}/10. 
              </p>
            </motion.div>

            <motion.div className="glass-card" variants={itemVariants} style={{ padding: '2.5rem', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                  <FiCalendar style={{ color: 'var(--secondary)' }} /> Recent Days
                </h3>
                <Link to="/mood-history" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>View Log</Link>
              </div>
              
              {history.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {history.slice(0, 3).map((entry) => (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.5)', border: '1px solid var(--glass-border)' }}>
                      <span style={{ fontSize: '2rem' }}>{entry.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </strong>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: entry.notes ? 'normal' : 'italic' }}>
                          {entry.notes?.slice(0, 40) || 'Just checking in...'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Your journey starts here. 🌷
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {history.length > 0 && (
          <motion.div className="chart-card-full glass-card" variants={itemVariants} style={{ marginTop: '2.5rem', padding: '2.5rem' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <FiActivity style={{ color: 'var(--primary)', fontSize: '1.5rem' }} />
              <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>Your mood this week</h2>
            </div>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rechartsData} margin={{ top: 30, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="weekday" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={(props) => {
                      const { x, y, payload } = props;
                      const entry = rechartsData[payload.index];
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={16} textAnchor="middle" fill="#64748b" fontSize={12} fontWeight={600}>
                            {entry.weekday}
                          </text>
                          <text x={0} y={0} dy={32} textAnchor="middle" fill="#94a3b8" fontSize={10}>
                            {entry.fullDate}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <YAxis 
                    domain={[1, 10]} 
                    ticks={[1, 3, 5, 7, 9]} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} 
                    dx={-10} 
                  />
                  <RechartsTooltip 
                    cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{ 
                            background: 'rgba(255, 255, 255, 0.95)', 
                            padding: '12px 16px', 
                            borderRadius: '16px', 
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                            border: '1px solid #f1f5f9',
                            backdropFilter: 'blur(10px)'
                          }}>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{data.weekday}, {data.fullDate}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                              <span style={{ fontSize: '1.5rem' }}>{data.emoji}</span>
                              <div>
                                <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Feeling {data.label}</p>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#2ebaa8', fontWeight: 600 }}>Score: {data.score}/10</p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <RechartsLine 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#2ebaa8" 
                    strokeWidth={4}
                    dot={<CustomDot />}
                    activeDot={{ r: 8, fill: '#2ebaa8', stroke: '#fff', strokeWidth: 3 }}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default MoodTracking;
