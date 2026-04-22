import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCalendar, FiClock, FiUser, FiVideo, FiX, FiCheckCircle, FiPlus, FiHeart, FiWind, FiStar } from 'react-icons/fi';
import './Appointments.css';

const Appointments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const response = await api.get('/appointments/my-appointments');
      setAppointments(response.data.appointments || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCompleted = async (appointmentId) => {
    try {
      await api.put(`/appointments/complete/${appointmentId}`);
      fetchAppointments();
    } catch (error) {
      console.error('Completion error:', error);
    }
  };

  const handleCancel = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to cancel this time? Your mental health matters.')) return;
    try {
      await api.put(`/appointments/cancel/${appointmentId}`);
      fetchAppointments();
    } catch (error) {
      console.error('Cancellation error:', error);
    }
  };

  const filteredAppointments = appointments.filter(apt => {
      const aptDate = new Date(`${apt.date}T${apt.start_time}`);
      const now = new Date();
      switch (filter) {
      case 'upcoming': return aptDate > now && !['cancelled', 'completed', 'pending_reassign'].includes(apt.status);
      case 'past': return aptDate < now || apt.status === 'completed';
      case 'cancelled': return apt.status === 'cancelled';
      default: return true;
    }
  });

  const variants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  if (loading) return (
    <div className="flex-center" style={{ height: '80vh' }}>
      <motion.div 
        animate={{ opacity: [0.5, 1, 0.5], scale: [0.95, 1, 0.95] }} 
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        style={{ fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '1rem' }}
      >
        <FiWind size={24} /> Preparing your schedule...
      </motion.div>
    </div>
  );

  return (
    <div className="appointments-page">
      <div className="container" style={{ maxWidth: '900px' }}>
        <header className="page-header" style={{ textAlign: 'center', margin: '3rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', marginBottom: '1.5rem' }}
          >
            <FiCalendar size={32} />
          </motion.div>
          <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ fontSize: '2.5rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Your Journey</motion.h1>
          <motion.p className="subtitle" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Making time for yourself is a beautiful step.</motion.p>
          
          {user?.userType === 'student' && (
            <motion.button 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ marginTop: '2rem', padding: '1rem 2rem', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.05rem' }}
              className="btn btn-primary" 
              onClick={() => navigate('/book-appointment')}
            >
              <FiPlus /> Schedule a Session
            </motion.button>
          )}
        </header>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem' }}>
          <div className="filter-nav glass-morphism" style={{ display: 'inline-flex', padding: '0.5rem', borderRadius: '100px', background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(46, 186, 168, 0.2)' }}>
            {['upcoming', 'past', 'cancelled'].map((f) => (
              <button
                key={f}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '100px',
                  border: 'none',
                  background: filter === f ? 'var(--primary)' : 'transparent',
                  color: filter === f ? '#fff' : 'var(--text-secondary)',
                  fontWeight: filter === f ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textTransform: 'capitalize'
                }}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="appointments-container" style={{ position: 'relative', paddingLeft: '1.5rem' }}>
          {/* Vertical Timeline Line */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '2rem', width: '2px', background: 'linear-gradient(to bottom, rgba(46, 186, 168, 0.3), rgba(46, 186, 168, 0.05))' }} />

          <AnimatePresence mode="wait">
            {filteredAppointments.length > 0 ? (
              <motion.div 
                key={filter}
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
                style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
              >
                {filteredAppointments.map((apt) => {
                  const aptDate = new Date(`${apt.date}T${apt.start_time}`);
                  const isUpcoming = aptDate > new Date() && apt.status !== 'cancelled' && apt.status !== 'completed';
                  const isPast = filter === 'past' || apt.status === 'completed';

                  return (
                    <motion.div key={apt.id} variants={variants} style={{ position: 'relative', paddingLeft: '3.5rem' }}>
                      {/* Timeline Dot */}
                      <div style={{ 
                        position: 'absolute', 
                        left: '0.15rem', 
                        top: '1.5rem', 
                        width: '16px', 
                        height: '16px', 
                        borderRadius: '50%', 
                        background: isPast ? 'var(--success)' : (apt.status === 'cancelled' ? 'var(--text-secondary)' : 'var(--primary)'), 
                        border: '4px solid var(--bg-primary)',
                        boxShadow: '0 0 0 2px rgba(46, 186, 168, 0.2)',
                        transform: 'translateX(-50%)',
                        zIndex: 2
                      }} />

                      <div className="appointment-card glass-card" style={{ padding: '2rem', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.8)', background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                          <div>
                            <p style={{ color: 'var(--primary)', fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                              <FiCalendar /> {aptDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </p>
                            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                              {user?.userType === 'student'
                                ? `Session with ${apt.counsellor?.name || 'Counsellor'}`
                                : `Session with ${apt.student?.name || 'Student'}`}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.75rem' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FiClock /> {apt.start_time.slice(0, 5)} - {apt.end_time.slice(0, 5)}</span>
                              {user?.userType === 'student' && apt.counsellor && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FiUser /> {apt.counsellor.department || 'Counselling'}</span>
                              )}
                            </div>
                          </div>
                          
                          {isPast && apt.status !== 'cancelled' ? (
                            <div style={{ background: 'rgba(46, 196, 182, 0.1)', color: 'var(--success)', padding: '0.5rem 1rem', borderRadius: '100px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <FiHeart /> You showed up for yourself 💙
                            </div>
                          ) : (
                            <span style={{ 
                              padding: '0.4rem 1rem', 
                              borderRadius: '100px', 
                              fontSize: '0.85rem', 
                              fontWeight: '600',
                              background: apt.status === 'cancelled' ? '#f1f5f9' : 'var(--primary-light)',
                              color: apt.status === 'cancelled' ? '#64748b' : 'var(--primary-dark)',
                              textTransform: 'capitalize'
                            }}>
                              {apt.status}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                          {user?.userType === 'student' ? (
                            <>
                              {isUpcoming ? (
                                <>
                                  <button style={{ padding: '0.8rem 1.5rem', borderRadius: '100px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.3s ease' }} onClick={() => navigate(`/session/${apt.id}`)} onMouseOver={(e) => e.target.style.transform='translateY(-2px)'} onMouseOut={(e) => e.target.style.transform='translateY(0)'}>
                                    <FiVideo size={18} /> Join Room
                                  </button>
                                  <button style={{ padding: '0.8rem 1.5rem', borderRadius: '100px', border: '1px solid #e2e8f0', background: 'transparent', color: 'var(--text-secondary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.3s ease' }} onClick={() => handleCancel(apt.id)} onMouseOver={(e) => e.target.style.background='#f8fafc'} onMouseOut={(e) => e.target.style.background='transparent'}>
                                    <FiX size={18} /> Reschedule
                                  </button>
                                </>
                              ) : apt.status === 'completed' && (
                                <button style={{ padding: '0.8rem 1.5rem', borderRadius: '100px', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.3s ease' }} onClick={() => navigate(`/feedback/${apt.id}`)}>
                                  <FiStar size={18} /> Reflect on Session
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {isUpcoming ? (
                                <button style={{ padding: '0.8rem 1.5rem', borderRadius: '100px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => navigate(`/session/${apt.id}`)}>
                                  <FiVideo size={18} /> Start Session
                                </button>
                              ) : apt.status !== 'completed' && apt.status !== 'cancelled' && (
                                <button style={{ padding: '0.8rem 1.5rem', borderRadius: '100px', border: '1px solid var(--success)', background: 'rgba(46, 196, 182, 0.05)', color: 'var(--success)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => handleMarkCompleted(apt.id)}>
                                  <FiCheckCircle size={18} /> Mark Complete
                                </button>
                              )}
                            </>
                          )}
                        </div>

                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.5)', borderRadius: '2rem', border: '1px dashed rgba(46, 186, 168, 0.3)', marginTop: '2rem', marginLeft: '3.5rem' }}
              >
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: 'var(--secondary)', boxShadow: 'var(--shadow-soft)' }}>
                  {filter === 'upcoming' ? <FiCalendar size={32} /> : (filter === 'past' ? <FiStar size={32} /> : <FiWind size={32} />)}
                </div>
                <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No {filter} moments here</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
                  {filter === 'upcoming' ? "Take this time for yourself. You're doing great, and we're here when you need to talk." : "Your journey is uniquely yours. Move forward gently."}
                </p>
                {user?.userType === 'student' && filter === 'upcoming' && (
                  <button 
                    className="btn btn-primary" 
                    onClick={() => navigate('/book-appointment')}
                    style={{ marginTop: '2rem', padding: '1rem 2.5rem', borderRadius: '100px', fontSize: '1.05rem' }}
                  >
                    Hold space for a session
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Appointments;
