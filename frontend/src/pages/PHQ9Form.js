import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheckCircle, FiChevronRight, FiChevronLeft, FiHeart } from 'react-icons/fi';
import api from '../utils/api';
import './Dashboard.css';

const questions = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself - or that you are a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed? Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual",
  "Thoughts that you would be better off dead, or of hurting yourself in some way"
];

const options = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" }
];

const PHQ9Form = () => {
  const navigate = useNavigate();
  const { appointmentId } = useParams();
  
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses] = useState(Array(9).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleSelect = (val) => {
    const newR = [...responses];
    newR[currentIdx] = val;
    setResponses(newR);
    
    if (currentIdx < questions.length - 1) {
      setTimeout(() => setCurrentIdx(currentIdx + 1), 300);
    }
  };

  const handleSubmit = async () => {
    if (responses.includes(null)) {
      alert("Please answer all questions before submitting.");
      return;
    }
    
    setSubmitting(true);
    const totalScore = responses.reduce((a, b) => a + b, 0);

    try {
      await api.post('/appointments/phq9', {
        appointmentId,
        responses,
        totalScore
      });
      setCompleted(true);
      setTimeout(() => navigate('/appointments'), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save questionnaire. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <div className="flex-center" style={{ minHeight: '80vh', flexDirection: 'column' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
          <FiCheckCircle size={64} color="#2ec4b6" style={{ marginBottom: '1rem' }} />
        </motion.div>
        <h2>Thank you for sharing</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Your counsellor will review this before your session.</p>
        <p style={{ fontSize: '0.9rem', marginTop: '2rem', color: '#94a3b8' }}>Redirecting to your appointments...</p>
      </div>
    );
  }

  const q = questions[currentIdx];

  return (
    <div className="container" style={{ maxWidth: '600px', marginTop: '4rem', paddingBottom: '4rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <FiHeart size={32} color="#2ec4b6" style={{ marginBottom: '1rem' }} />
        <h2>Pre-Session Check-in</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Over the last 2 weeks, how often have you been bothered by any of the following problems?
        </p>
      </header>

      <div className="glass-card" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <span>Question {currentIdx + 1} of 9</span>
          <div style={{ width: '100px', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', alignSelf: 'center' }}>
            <div style={{ width: `${((currentIdx + 1) / 9) * 100}%`, height: '100%', background: '#2ec4b6', transition: 'width 0.3s' }}></div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <h3 style={{ fontSize: '1.2rem', lineHeight: '1.5', marginBottom: '2rem' }}>
              {currentIdx + 1}. {q}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    borderRadius: '8px',
                    border: '2px solid',
                    borderColor: responses[currentIdx] === opt.value ? '#2ec4b6' : 'transparent',
                    background: responses[currentIdx] === opt.value ? 'rgba(46, 196, 182, 0.1)' : 'rgba(255,255,255,0.5)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: responses[currentIdx] === opt.value ? '600' : '400'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem' }}>
          <button 
            className="btn-outline-mini" 
            onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: currentIdx === 0 ? 0.3 : 1 }}
          >
             <FiChevronLeft /> Previous
          </button>

          {currentIdx === questions.length - 1 ? (
            <button 
              className="btn-primary" 
              onClick={handleSubmit}
              disabled={submitting || responses.includes(null)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem' }}
            >
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </button>
          ) : (
            <button 
              className="btn-outline-mini" 
              onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}
              disabled={responses[currentIdx] === null}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: responses[currentIdx] === null ? 0.3 : 1 }}
            >
              Next <FiChevronRight />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PHQ9Form;
