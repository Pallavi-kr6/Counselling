import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { 
  FiSmile, 
  FiWind, 
  FiMoon, 
  FiEdit3, 
  FiHeart, 
  FiActivity, 
  FiCalendar,
  FiChevronRight
} from 'react-icons/fi';
import './MoodTracking.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const MoodTracking = () => {
  const [mood, setMood] = useState(5);
  const [stressLevel, setStressLevel] = useState(5);
  const [sleepHours, setSleepHours] = useState(7);
  const [notes, setNotes] = useState('');
  const [emoji, setEmoji] = useState('😐');
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const emojis = [
    { icon: '😢', label: 'Struggling', val: 2 },
    { icon: '😔', label: 'Down', val: 4 },
    { icon: '😐', label: 'Okay', val: 6 },
    { icon: '🙂', label: 'Good', val: 8 },
    { icon: '😊', label: 'Great', val: 10 }
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

  const fetchMoodHistory = async () => {
    try {
      const response = await api.get('/mood/history');
      setHistory(response.data.history || []);
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
    setSubmitting(true);
    try {
      await api.post('/mood/check-in', {
        mood, emoji, stressLevel, sleepHours, notes
      });
      setNotes('');
      fetchMoodHistory();
      fetchDashboard();
    } catch (error) {
      console.error('Error saving check-in:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const chartData = {
    labels: history.slice(0, 7).reverse().map(entry => 
      new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short' })
    ),
    datasets: [
      {
        label: 'Heartspace',
        data: history.slice(0, 7).reverse().map(entry => entry.mood),
        borderColor: '#2ebaa8',
        backgroundColor: 'rgba(46, 186, 168, 0.1)',
        fill: true,
        tension: 0.5,
        pointBackgroundColor: '#2ebaa8',
        borderWidth: 3
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#334155',
        bodyColor: '#334155',
        borderColor: 'rgba(46, 186, 168, 0.2)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12
      }
    },
    scales: {
      y: { display: false, min: 0, max: 10 },
      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'inherit' } } }
    }
  };

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

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ padding: '1.25rem', fontSize: '1.1rem', borderRadius: '100px' }}>
                {submitting ? 'Holding space...' : 'Save this moment'}
              </button>
            </form>
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            <motion.div className="glass-card" variants={itemVariants} style={{ padding: '2.5rem', background: 'linear-gradient(135deg, rgba(230, 247, 246, 0.9), rgba(255, 255, 255, 0.95))', border: '1px solid rgba(46, 186, 168, 0.15)' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <FiHeart size={24} style={{ color: 'var(--primary-dark)' }} />
                <h3 style={{ fontSize: '1.2rem', color: 'var(--primary-dark)' }}>Gentle Insight</h3>
              </div>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1rem' }}>
                {stats?.trend === 'improving' ? "You've been feeling better this week 💛 Keep embracing these small moments of peace." : "It looks like things have been heavy lately. Please remember to be kind to yourself. 🌿"}
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
              <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>Your Heartspace Over Time</h2>
            </div>
            <div style={{ height: '300px', width: '100%' }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default MoodTracking;
