import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCalendar, FiUser, FiClock, FiCheck, FiChevronRight, FiChevronLeft, FiMapPin, FiInfo, FiCheckCircle } from 'react-icons/fi';
import './BookAppointment.css';

const BookAppointmentDayOrder = () => {
  const navigate = useNavigate();
  const [dayOrders, setDayOrders] = useState([]);
  const [selectedDayOrder, setSelectedDayOrder] = useState(null);
  const [counsellors, setCounsellors] = useState([]);
  const [selectedCounsellor, setSelectedCounsellor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [loadingCounsellors, setLoadingCounsellors] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    fetchDayOrders();
  }, []);

  const fetchDayOrders = async () => {
    try {
      const response = await api.get('/appointments/day-orders');
      setDayOrders(response.data.dayOrders || []);
      if (response.data.dayOrders?.length > 0) {
        setSelectedDayOrder(response.data.dayOrders[0]);
      }
    } catch (err) {
      setError('Technical difficulty loading schedule. Please try again.');
    }
  };

  useEffect(() => {
    if (!selectedDayOrder) return;
    const fetchCounsellors = async () => {
      setLoadingCounsellors(true);
      setError('');
      try {
        const resp = await api.get(`/appointments/day-order/${selectedDayOrder.id}/counsellors`);
        setCounsellors(resp.data.counsellors || []);
      } catch (err) {
        setError('Failed to fetch available experts.');
      } finally {
        setLoadingCounsellors(false);
      }
    };
    fetchCounsellors();
  }, [selectedDayOrder]);

  useEffect(() => {
    if (!selectedDayOrder || !selectedCounsellor) return;
    const fetchSlots = async () => {
      setLoadingSlots(true);
      setError('');
      try {
        const resp = await api.get(
          `/appointments/day-order/${selectedDayOrder.id}/counsellors/${selectedCounsellor.counsellor_id}/slots`
        );
        setAvailableSlots(resp.data.slots || []);
      } catch (err) {
        setError('Failed to load availability blocks.');
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [selectedDayOrder, selectedCounsellor]);

  const handleBook = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await api.post('/appointments/book-day-order', {
        dayOrderId: selectedDayOrder.id,
        counsellorId: selectedCounsellor.counsellor_id,
        date: selectedDate,
        startTime: selectedSlot.start_time,
        endTime: selectedSlot.end_time,
        notes
      });
      const aptId = resp.data?.appointment?.id;
      setSuccess('Your session is scheduled. We are here for you.');
      setTimeout(() => {
        if (aptId) navigate(`/phq9/${aptId}`);
        else navigate('/appointments');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Booking encountered an issue. Let\'s try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, label: 'Schedule', icon: <FiCalendar /> },
    { id: 2, label: 'Counsellor', icon: <FiUser /> },
    { id: 3, label: 'Details', icon: <FiClock /> },
  ];

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const contentVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className="book-appointment">
      <div className="container">
        <header className="page-header">
          <h1>Plan Your Session</h1>
          <p className="subtitle">Choose a comfortable time to connect with our experts.</p>
        </header>

        <div className="booking-stepper glass-morphism">
          {steps.map(step => (
            <div key={step.id} className={`step-indicator ${currentStep >= step.id ? 'active' : ''}`}>
              <div className="step-circle">{currentStep > step.id ? <FiCheck /> : step.icon}</div>
              <span>{step.label}</span>
            </div>
          ))}
        </div>

        <div className="booking-content-wrapper">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div key="step1" variants={contentVariants} initial="hidden" animate="visible" exit="exit" className="booking-step-panel">
                <div className="step-header">
                  <h2>When would you like to visit?</h2>
                  <p>Select the academic day order and your preferred date.</p>
                </div>
                <div className="selection-group">
                  <div className="form-group-modern">
                    <label>Day Order</label>
                    <select
                      className="glass-select"
                      value={selectedDayOrder?.id || ''}
                      onChange={(e) => setSelectedDayOrder(dayOrders.find(d => d.id === e.target.value))}
                    >
                      {dayOrders.map(d => <option key={d.id} value={d.id}>{d.order_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group-modern">
                    <label>Preferred Date</label>
                    <input
                      type="date"
                      className="glass-input"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
                <div className="step-actions">
                  <button className="btn btn-primary" onClick={nextStep} disabled={!selectedDayOrder}>
                    Continue Selection <FiChevronRight />
                  </button>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div key="step2" variants={contentVariants} initial="hidden" animate="visible" exit="exit" className="booking-step-panel">
                <div className="step-header">
                  <h2>Choose your Digital Companion</h2>
                  <p>Our empathetic counsellors are ready to support you.</p>
                </div>
                {loadingCounsellors ? (
                  <div className="loading-spinner">Discovering available experts...</div>
                ) : (
                  <div className="counsellors-grid-modern">
                    {counsellors.map(c => (
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        key={c.counsellor_id}
                        className={`counsellor-card-premium glass-card ${selectedCounsellor?.counsellor_id === c.counsellor_id ? 'selected' : ''}`}
                        onClick={() => setSelectedCounsellor(c)}
                      >
                        <div className="c-avatar"><FiUser /></div>
                        <div className="c-info">
                          <h3>{c.counsellor_name}</h3>
                          <span className="c-tag">{c.designation}</span>
                          <div className="c-details">
                            {c.room_no && <span><FiMapPin /> Room {c.room_no}</span>}
                            {c.department && <span><FiInfo /> {c.department}</span>}
                          </div>
                        </div>
                        {selectedCounsellor?.counsellor_id === c.counsellor_id && <div className="selected-check"><FiCheck /></div>}
                      </motion.div>
                    ))}
                  </div>
                )}
                <div className="step-actions split">
                  <button className="btn btn-ghost" onClick={prevStep}><FiChevronLeft /> Back</button>
                  <button className="btn btn-primary" onClick={nextStep} disabled={!selectedCounsellor}>
                    Select Time Slot <FiChevronRight />
                  </button>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div key="step3" variants={contentVariants} initial="hidden" animate="visible" exit="exit" className="booking-step-panel">
                <div className="step-header">
                  <h2>Finalize your Session</h2>
                  <p>Pick a slot and share anything you'd like us to know.</p>
                </div>
                
                <div className="slots-section">
                  <label className="section-label">Available Slots</label>
                  {loadingSlots ? (
                    <div className="loading-spinner">Checking availability...</div>
                  ) : availableSlots.length > 0 ? (
                    <div className="slots-grid-modern">
                      {availableSlots.map(slot => (
                        <button
                          key={slot.availability_id}
                          className={`slot-chip ${selectedSlot?.availability_id === slot.availability_id ? 'selected' : ''}`}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          {slot.start_time} - {slot.end_time}
                        </button>
                      ))}
                    </div>
                  ) : <div className="no-slots-alert">No sessions available for this day order.</div>}
                </div>

                <div className="notes-section">
                  <label className="section-label">Personal Note (Optional)</label>
                  <textarea
                    className="glass-textarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Short description of what you'd like to talk about..."
                  />
                </div>

                {selectedCounsellor && selectedSlot && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="final-summary glass-card">
                    <FiCheckCircle className="summary-icon" />
                    <div className="summary-text">
                      <strong>{selectedCounsellor.counsellor_name}</strong>
                      <span>{new Date(selectedDate).toDateString()} @ {selectedSlot.start_time}</span>
                    </div>
                  </motion.div>
                )}

                <div className="step-actions split">
                  <button className="btn btn-ghost" onClick={prevStep}><FiChevronLeft /> Back</button>
                  <button className="btn btn-book-final" onClick={handleBook} disabled={!selectedSlot || loading}>
                    {loading ? 'Securing your Slot...' : 'Confirm My Session'}
                  </button>
                </div>
                {error && <p className="error-message-modern">{error}</p>}
                {success && <p className="success-message-modern">{success}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default BookAppointmentDayOrder;
