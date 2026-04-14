import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCalendar, 
  FiHeart, 
  FiBook, 
  FiPhone, 
  FiArrowRight, 
  FiWind,
  FiSunrise,
  FiMoon,
  FiActivity,
  FiPlayCircle,
  FiTrendingUp
} from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [moodStreak] = useState(3);
  const [hasMoodToday] = useState(false);
  const [aiMoodLogs, setAiMoodLogs] = useState([]);
  
  const greeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good morning", icon: FiSunrise };
    if (hour < 18) return { text: "Good afternoon", icon: FiWind };
    return { text: "Good evening", icon: FiMoon };
  }, []);

  const fetchStudentDashboard = useCallback(async () => {
    try {
      const apptResponse = await api.get('/appointments/my-appointments');
      const appointments = apptResponse.data.appointments || [];

      const upcoming = appointments
        .filter(apt => {
          const aptDate = new Date(`${apt.date}T${apt.start_time}`);
          return aptDate > new Date() && apt.status !== 'cancelled' && apt.status !== 'completed';
        })
        .sort((a, b) => new Date(a.date + 'T' + a.start_time) - new Date(b.date + 'T' + b.start_time))
        .slice(0, 2);

      setUpcomingAppointments(upcoming);

      // Fetch AI sentiment logs
      try {
        const moodResponse = await api.get('/mood/ai-logs-trend');
        // map data for recharts
        const formattedLogs = (moodResponse.data.logs || []).map(log => ({
          date: new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          score: log.score,
          label: log.label
        }));
        setAiMoodLogs(formattedLogs);
      } catch (err) {
        console.error('Failed to load AI mood trend', err);
      }

    } catch (err) {
      console.error('Error fetching student dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || !user.id) return;
    fetchStudentDashboard();
  }, [user, fetchStudentDashboard]);

  if (loading) return (
    <div className="flex-center" style={{ height: '80vh' }}>
      <motion.div 
        animate={{ opacity: [0.5, 1, 0.5], scale: [0.98, 1, 0.98] }} 
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        style={{ fontSize: '1.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '1rem' }}
      >
        <FiWind /> Breathe in... Breathe out...
      </motion.div>
    </div>
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.15, duration: 1, ease: "easeInOut" }
    }
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const TimeIcon = greeting().icon;

  return (
    <motion.div 
      className="dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="container" style={{ maxWidth: '1000px', paddingBottom: '4rem' }}>
        <header className="dashboard-header" style={{ textAlign: 'center', marginTop: '3rem', paddingBottom: '2rem' }}>
          <motion.div variants={itemVariants} style={{ display: 'inline-block', padding: '0.75rem', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', marginBottom: '1rem' }}>
            <TimeIcon size={24} />
          </motion.div>
          <motion.h1 variants={itemVariants} style={{ fontSize: '2.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>
            {greeting().text}, {user.name ? user.name.split(' ')[0] : 'friend'}.
          </motion.h1>
          <motion.p className="welcome-subtitle" variants={itemVariants} style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
            Take a deep breath. You're in a safe space.
          </motion.p>
        </header>

        <motion.div className="welcome-hero glass-card" variants={itemVariants} style={{ textAlign: 'center', padding: '3.5rem 2rem', background: 'linear-gradient(135deg, rgba(230, 247, 246, 0.8), rgba(255, 255, 255, 0.95))', border: '1px solid rgba(46, 186, 168, 0.2)', marginBottom: '3rem' }}>
          <div className="welcome-hero-content">
            <h2 className="hero-title" style={{ color: 'var(--primary-dark)', fontSize: '1.8rem', marginBottom: '1rem' }}>How is your heart today? 🤍</h2>
            <p className="hero-message" style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 2.5rem auto' }}>
              Whether you're feeling overwhelmed, perfectly fine, or somewhere in between your feelings are valid. Would you like to check in?
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate('/mood')} style={{ padding: '1rem 2.5rem', borderRadius: '100px', fontSize: '1.05rem', boxShadow: '0 8px 25px rgba(46, 186, 168, 0.25)' }}>
                Share how you feel
              </button>
              <button onClick={() => navigate('/ai-counselling')} style={{ padding: '1rem 2.5rem', background: 'rgba(255, 255, 255, 0.9)', color: 'var(--text-primary)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '100px', fontSize: '1.05rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }} onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}>
                Chat with someone
              </button>
            </div>
          </div>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          
          {/* Daily Suggestion */}
          <motion.div className="dashboard-card glass-card" variants={itemVariants} style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.3rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiWind style={{ color: 'var(--primary)' }} /> Gentle Suggestion
            </h3>
            <div style={{ background: 'var(--primary-light)', borderRadius: '1.5rem', padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600', color: 'var(--primary)', marginBottom: '0.5rem' }}>For You Today</span>
              <h4 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>5-Minute Breathing Reset</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>A quick, guided rhythm to help lower your heart rate and find some quiet.</p>
              
              <button 
                onClick={() => navigate('/breathe')}
                style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.8rem', borderRadius: '100px', background: '#fff', color: 'var(--primary)', border: 'none', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', transition: 'all 0.3s' }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <FiPlayCircle size={18} /> softly begin
              </button>
            </div>
          </motion.div>

          {/* Activity / Continue */}
          <motion.div className="dashboard-card glass-card" variants={itemVariants} style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.3rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiActivity style={{ color: 'var(--secondary)' }} /> Your Momentum
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)', lineHeight: '1' }}>{moodStreak}</span>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '600', color: 'var(--text-secondary)' }}>Days</span>
              </div>
              <div>
                <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Consistent Check-ins</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>You're building a beautiful habit of self-awareness. Every small step counts.</p>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: '1rem', padding: '1rem', border: '1px solid var(--glass-border)', marginTop: 'auto' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiBook color="var(--primary)" /> Continue where you left off
              </p>
              <div 
                style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => navigate('/resources')}
              >
                <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>Managing Academic Stress</span>
                <FiArrowRight color="var(--text-secondary)" />
              </div>
            </div>
          </motion.div>

          {/* Upcoming Appointments */}
          <motion.div className="dashboard-card glass-card" variants={itemVariants} style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiCalendar style={{ color: 'var(--primary-dark)' }} /> Upcoming Time
              </h3>
            </div>
            
            {upcomingAppointments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {upcomingAppointments.map((apt) => (
                  <motion.div key={apt.id} style={{ padding: '1.25rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.7)', borderLeft: '4px solid var(--primary)', border: '1px solid var(--glass-border)', borderLeftWidth: '4px', borderLeftColor: 'var(--primary)' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                      {new Date(apt.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                      Session with {apt.counsellor?.name || 'Counsellor'}
                    </h4>
                    <p style={{ color: 'var(--primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
                      <FiWind /> {apt.start_time} - Making time for you.
                    </p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'rgba(255,255,255,0.4)', borderRadius: '1rem', border: '1px dashed rgba(46, 186, 168, 0.3)' }}>
                <FiWind style={{ fontSize: '2rem', color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.5 }} />
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  You have no scheduled sessions right now.<br/>Take things at your own pace. 🌱
                </p>
                <button
                  onClick={() => navigate('/book-appointment')}
                  style={{ marginTop: '1rem', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0.5rem 1.5rem', borderRadius: '100px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s' }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--primary)'; }}
                >
                  Schedule one
                </button>
              </div>
            )}
          </motion.div>

          {/* AI Sentiment Trend Card */}
          <motion.div className="dashboard-card glass-card" variants={itemVariants} style={{ padding: '2.5rem', gridColumn: 'span auto' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.3rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiTrendingUp style={{ color: '#2ec4b6' }} /> Subconscious Sentiment
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              We analyze your conversation sentiment in the background to provide you with insights over time.
            </p>

            <div style={{ width: '100%', height: 250, background: 'rgba(255,255,255,0.4)', borderRadius: '1rem', padding: '1rem 0', border: '1px solid rgba(46,196,182,0.1)' }}>
              {aiMoodLogs.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aiMoodLogs} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[1, 10]} ticks={[1, 3, 6, 10]} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }} 
                      labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.3rem' }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#2ec4b6" strokeWidth={3} dot={{ r: 4, fill: '#2ec4b6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-center" style={{ height: '100%', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                  <FiHeart size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p>Chat with our AI bot to generate sentiment insights.</p>
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
};

export default StudentDashboard;
