import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiWind } from 'react-icons/fi';
import './Resources.css'; // Reusing general page styles

const Breathe = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('inhale'); // 'inhale', 'hold1', 'exhale', 'hold2'
  const [isActive, setIsActive] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);

  useEffect(() => {
    let timeout;
    if (isActive) {
      if (phase === 'inhale') {
        timeout = setTimeout(() => setPhase('hold1'), 4000); // Inhale 4s
      } else if (phase === 'hold1') {
        timeout = setTimeout(() => setPhase('exhale'), 4000); // Hold 4s
      } else if (phase === 'exhale') {
        timeout = setTimeout(() => setPhase('hold2'), 4000); // Exhale 4s
      } else if (phase === 'hold2') {
        timeout = setTimeout(() => {
          setPhase('inhale');
          setCycleCount(c => c + 1);
        }, 4000); // Hold 4s
      }
    }
    return () => clearTimeout(timeout);
  }, [phase, isActive]);

  const toggleExercise = () => {
    if (!isActive) {
      setPhase('inhale');
      setCycleCount(0);
    }
    setIsActive(!isActive);
  };

  const getPhaseText = () => {
    if (!isActive) return 'Ready when you are';
    switch (phase) {
      case 'inhale': return 'Breathe in...';
      case 'hold1': return 'Hold gently...';
      case 'exhale': return 'Breathe out...';
      case 'hold2': return 'Rest empty...';
      default: return '';
    }
  };

  const getCircleScale = () => {
    if (!isActive) return 1;
    switch (phase) {
      case 'inhale': return 2;
      case 'hold1': return 2;
      case 'exhale': return 1;
      case 'hold2': return 1;
      default: return 1;
    }
  };

  return (
    <div className="breathe-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      
      <button 
        onClick={() => navigate(-1)} 
        style={{ position: 'absolute', top: '2rem', left: '2rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '1rem', fontWeight: '500' }}
      >
        <FiArrowLeft /> back
      </button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: '600' }}>Box Breathing</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '400px', margin: '0 auto' }}>
          Follow the circle. Inhale, hold, exhale, hold. We'll do this together.
        </p>
      </motion.div>

      <div style={{ position: 'relative', width: '300px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          animate={{ scale: getCircleScale() }}
          transition={{ duration: 4, ease: "easeInOut" }}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'var(--primary-light)',
            position: 'absolute',
            zIndex: 1,
            boxShadow: '0 0 40px rgba(46, 186, 168, 0.4)'
          }}
        />
        
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <motion.div 
            key={getPhaseText()}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.5 }}
            style={{ fontSize: '1.4rem', fontWeight: '600', color: isActive && (phase === 'inhale' || phase === 'hold1') ? 'var(--primary-dark)' : 'var(--text-primary)' }}
          >
            {getPhaseText()}
          </motion.div>
        </div>
      </div>

      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleExercise}
        style={{
          marginTop: '4rem',
          padding: '1rem 3rem',
          borderRadius: '100px',
          background: isActive ? 'transparent' : 'var(--primary)',
          color: isActive ? 'var(--text-secondary)' : '#fff',
          border: isActive ? '1px solid var(--text-secondary)' : 'none',
          fontSize: '1.1rem',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: isActive ? 'none' : '0 8px 25px rgba(46, 186, 168, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          transition: 'all 0.3s'
        }}
      >
        <FiWind /> {isActive ? 'Stop Practice' : 'Start Practice'}
      </motion.button>
      
      <AnimatePresence>
        {cycleCount > 0 && isActive && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            style={{ marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}
          >
            {cycleCount} full {cycleCount === 1 ? 'cycle' : 'cycles'} completed. You're doing great.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Breathe;