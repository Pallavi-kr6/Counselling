import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiCalendar, FiClock, FiHeart, FiCheckCircle, FiInfo } from 'react-icons/fi';
import './BookAppointment.css';

const BookAppointment = () => {
  const navigate = useNavigate();
  const [counsellors, setCounsellors] = useState([]);
  const [selectedCounsellor, setSelectedCounsellor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchCounsellors();
    const interval = setInterval(fetchCounsellors, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchCounsellors = async () => {
    try {
      const response = await api.get('/profiles/counsellors');
      setCounsellors(response.data.counsellors || []);
    } catch (error) {
      console.error('Error fetching counsellors:', error);
    }
  };

  const fetchAvailableSlots = useCallback(async () => {
    if (!selectedCounsellor) return;

    if (selectedCounsellor.isAvailable === false) {
      setAvailableSlots([]);
      setError('This counsellor is currently unavailable for booking.');
      return;
    }

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const { data } = await api.get(`/appointments/slots/${selectedCounsellor.user_id}?date=${dateStr}`);
      setAvailableSlots(data.slots || []);
      if (data.slots && data.slots.length > 0) {
        setError('');
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
      setError(error.response?.data?.error || 'Unable to fetch available slots. This counsellor may be unavailable.');
    }
  }, [selectedCounsellor, selectedDate]);

  useEffect(() => {
    if (selectedCounsellor && selectedDate) {
      setSelectedSlot(null);
      fetchAvailableSlots();
    }
  }, [selectedCounsellor, selectedDate, fetchAvailableSlots]);

  const handleCounsellorSelect = (counsellor) => {
    if (counsellor.isAvailable === false) {
      setError('This counsellor is currently unavailable for booking.');
      return;
    }
    setSelectedCounsellor(counsellor);
    setError('');
  };

  const handleBook = async () => {
    if (!selectedCounsellor || !selectedSlot || !selectedDate) {
      setError('Please select counsellor, date, and time slot');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      await api.post('/appointments/book', {
        counsellorId: selectedCounsellor.user_id,
        date: dateStr,
        startTime: selectedSlot.start_time,
        endTime: selectedSlot.end_time,
        notes: notes
      });

      setSuccess('Connection scheduled. We will send you a gentle reminder before the session.');
      setTimeout(() => {
        navigate('/appointments');
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'We had trouble holding that time for you. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stepVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="book-appointment-page" style={{ padding: '3rem 0', minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', marginBottom: '1.5rem' }}>
            <FiHeart size={32} />
          </motion.div>
          <motion.h1 initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ fontSize: '2.5rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Holding Space For You
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
            Take your time. Choose someone you feel comfortable talking to.
          </motion.p>
        </header>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '1rem', color: '#ef4444', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <FiInfo /> {error}
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ padding: '1.5rem', background: 'var(--success-light)', border: '1px solid rgba(46, 196, 182, 0.3)', borderRadius: '1rem', color: 'var(--success)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem', fontWeight: '500' }}>
              <FiCheckCircle size={24} /> {success}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <motion.section variants={stepVariants} initial="hidden" animate="visible" className="glass-card" style={{ padding: '2.5rem', borderRadius: '1.5rem' }}>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '600' }}>1</span> Choose your listener
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {counsellors.map((counsellor) => (
                <div
                  key={counsellor.id}
                  style={{
                    padding: '1.5rem',
                    borderRadius: '1rem',
                    background: selectedCounsellor?.id === counsellor.id ? 'var(--primary-light)' : 'rgba(255,255,255,0.6)',
                    border: `2px solid ${selectedCounsellor?.id === counsellor.id ? 'var(--primary)' : 'rgba(46, 186, 168, 0.1)'}`,
                    cursor: counsellor.isAvailable ? 'pointer' : 'not-allowed',
                    opacity: counsellor.isAvailable ? 1 : 0.6,
                    transition: 'all 0.3s ease',
                    boxShadow: selectedCounsellor?.id === counsellor.id ? '0 4px 15px rgba(46, 186, 168, 0.15)' : 'none'
                  }}
                  onClick={() => handleCounsellorSelect(counsellor)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--sidebar-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                      <FiUser size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>{counsellor.name}</h3>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{counsellor.department || 'Counselling'}</p>
                    </div>
                  </div>
                  {counsellor.isAvailable ? (
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--success)', background: 'rgba(46, 204, 113, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '100px' }}>Available</span>
                  ) : (
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', background: 'var(--sidebar-hover)', padding: '0.2rem 0.6rem', borderRadius: '100px' }}>Unavailable</span>
                  )}
                </div>
              ))}
            </div>
          </motion.section>

          <AnimatePresence>
            {selectedCounsellor && (
              <motion.section variants={stepVariants} initial="hidden" animate="visible" exit="hidden" className="glass-card" style={{ padding: '2.5rem', borderRadius: '1.5rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '600' }}>2</span> Find a time that works
                </h2>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem' }}>
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.7)', borderRadius: '1rem', border: '1px solid rgba(46, 186, 168, 0.2)' }}>
                      <Calendar
                        onChange={setSelectedDate}
                        value={selectedDate}
                        minDate={new Date()}
                        tileDisabled={({ date }) => date < new Date() || date.getDay() === 0} // Just a visual example, but let backend validate
                        className="custom-calendar"
                      />
                    </div>
                  </div>

                  <div style={{ flex: '1 1 300px' }}>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                      <FiClock style={{ marginRight: '0.5rem', color: 'var(--text-secondary)' }} />
                      Available Moments on {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </h3>
                    
                    {availableSlots.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '1rem' }}>
                        {availableSlots.map((slot, index) => (
                          <button
                            key={index}
                            style={{
                              padding: '0.8rem',
                              borderRadius: '100px',
                              background: selectedSlot?.start_time === slot.start_time ? 'var(--primary)' : 'rgba(255,255,255,0.8)',
                              color: selectedSlot?.start_time === slot.start_time ? '#fff' : 'var(--text-primary)',
                              border: selectedSlot?.start_time === slot.start_time ? 'none' : '1px solid rgba(0,0,0,0.1)',
                              fontWeight: selectedSlot?.start_time === slot.start_time ? '600' : '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: selectedSlot?.start_time === slot.start_time ? '0 4px 10px rgba(46, 186, 168, 0.3)' : 'none'
                            }}
                            onClick={() => setSelectedSlot(slot)}
                          >
                            {slot.start_time.slice(0, 5)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--sidebar-hover)', borderRadius: '1rem', color: 'var(--text-secondary)' }}>
                        <FiCalendar size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                        <p>No available times for this day. Please try another date.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.section>
            )}

            {selectedCounsellor && selectedSlot && (
              <motion.section variants={stepVariants} initial="hidden" animate="visible" exit="hidden" className="glass-card" style={{ padding: '2.5rem', borderRadius: '1.5rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '600' }}>3</span> Anything you'd like us to know?
                </h2>
                
                <textarea
                  style={{
                    width: '100%',
                    padding: '1.5rem',
                    borderRadius: '1rem',
                    border: '1px solid rgba(46, 186, 168, 0.2)',
                    background: 'rgba(255,255,255,0.8)',
                    fontSize: '1rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '120px',
                    outline: 'none',
                    transition: 'border-color 0.3s ease'
                  }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Share a little context if you want, or just leave this blank. There's no pressure."
                />

                <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      padding: '1rem 2.5rem',
                      borderRadius: '100px',
                      background: 'var(--primary)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      cursor: loading ? 'wait' : 'pointer',
                      boxShadow: '0 8px 20px rgba(46, 186, 168, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                    onClick={handleBook}
                    disabled={loading}
                  >
                    {loading ? 'Confirming...' : 'Yes, Confirm Session'} <FiCheckCircle />
                  </motion.button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default BookAppointment;
