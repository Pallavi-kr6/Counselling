import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiHeart, FiWind, FiInfo, FiShield } from 'react-icons/fi';
import './Emergency.css';

const Emergency = () => {
  const [showCampusAlert, setShowCampusAlert] = useState(false);
  const [contacts] = useState([
    {
      name: 'KIRAN Helpline',
      phone: '1800-599-0019',
      type: 'National Support 24/7',
      description: 'A free, confidential space to talk with a professional.'
    },
    {
      name: 'Vandrevala Foundation',
      phone: '9999666555',
      type: 'Immediate Support',
      description: 'Someone is ready to listen to you right now.'
    },
    {
      name: 'Campus Support',
      phone: 'YOUR_CAMPUS_PHONE',
      type: 'University Care',
      description: 'Connect with someone nearby who can help.'
    }
  ]);

  const handleCall = (phone) => {
    if (phone && phone !== 'YOUR_CAMPUS_PHONE') {
      window.location.href = `tel:${phone}`;
    } else {
      setShowCampusAlert(true);
      setTimeout(() => setShowCampusAlert(false), 8000);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: "easeOut" } }
  };

  return (
    <div className="emergency-page" style={{ paddingBottom: '4rem' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <header className="emergency-header" style={{ textAlign: 'center', margin: '3rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            style={{ padding: '1.25rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', marginBottom: '1.5rem', display: 'inline-flex' }}
          >
            <FiHeart size={36} />
          </motion.div>
          
          <motion.h1 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{ fontSize: '2.8rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}
          >
            You are not alone.
          </motion.h1>
          
          <motion.p 
            className="subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '500px', lineHeight: '1.6' }}
          >
            Help is here, right now. Take a deep breath. There are people who care and want to support you through this exact moment.
          </motion.p>
        </header>

        <AnimatePresence>
          {showCampusAlert && (
            <motion.div 
              initial={{ height: 0, opacity: 0, y: -10 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, scale: 0.95 }}
              style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(46, 186, 168, 0.3)', borderRadius: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '2rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}
            >
              <FiInfo style={{ color: 'var(--primary)', fontSize: '1.5rem', flexShrink: 0, marginTop: '2px' }} />
              <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', margin: 0 }}>
                Please check your university portal for your specific campus emergency number. In the meantime, the national helplines below are free, confidential, and available right now.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
        >
          {contacts.map((contact, index) => (
            <motion.div 
              key={index} 
              variants={itemVariants}
              className="glass-card"
              style={{ 
                padding: '2rem', 
                borderRadius: '1.5rem', 
                display: 'flex', 
                flexWrap: 'wrap',
                alignItems: 'center', 
                justifyContent: 'space-between',
                gap: '2rem',
                border: '1px solid rgba(255,255,255,0.8)',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7))'
              }}
            >
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ display: 'inline-block', padding: '0.3rem 0.8rem', borderRadius: '100px', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {contact.type}
                </div>
                <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{contact.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.5' }}>{contact.description}</p>
                <div style={{ marginTop: '1rem', fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FiPhone style={{ color: 'var(--text-secondary)' }} /> {contact.phone !== 'YOUR_CAMPUS_PHONE' ? contact.phone : 'Campus specific'}
                </div>
              </div>
              
              <button
                onClick={() => handleCall(contact.phone)}
                style={{
                  padding: '1.2rem 2.5rem',
                  borderRadius: '100px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  fontSize: '1.2rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(239, 68, 68, 0.3)',
                  transition: 'all 0.3s ease',
                  flexShrink: 0
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 25px rgba(239, 68, 68, 0.4)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.3)'; }}
              >
                <FiPhone /> Reach Out Now
              </button>
            </motion.div>
          ))}
        </motion.div>

        <motion.div 
          className="support-info-card glass-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{ marginTop: '3rem', padding: '2.5rem', borderRadius: '1.5rem', background: 'rgba(255,255,255,0.6)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '50%', background: 'var(--secondary-light)', color: 'var(--secondary)' }}>
              <FiShield size={24} />
            </div>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)' }}>Gentle Steps for Right Now</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <FiCheckCircle className="check-icon" style={{ color: 'var(--secondary)', marginTop: '4px', flexShrink: 0 }} />
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Find a space where you feel physically comfortable, perhaps a quiet room or somewhere you can sit down.</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <FiCheckCircle className="check-icon" style={{ color: 'var(--secondary)', marginTop: '4px', flexShrink: 0 }} />
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Remember that the people answering these calls are there specifically because they want to listen to you. There is no judgment.</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <FiCheckCircle className="check-icon" style={{ color: 'var(--secondary)', marginTop: '4px', flexShrink: 0 }} />
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>If talking feels like too much, it's okay to just breathe on the line with them for a moment.</p>
            </div>
          </div>
        </motion.div>

        <footer style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-secondary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <FiWind /> Breathe. This heavy feeling will pass.
        </footer>
      </div>
    </div>
  );
};

// Internal icon for bullet points
const FiCheckCircle = ({ className, style }) => (
  <svg className={className} style={style} stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
);

export default Emergency;
