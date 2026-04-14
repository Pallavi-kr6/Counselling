import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { FiX, FiType, FiCheck } from 'react-icons/fi';
import './PersonalizationPanel.css';

const PersonalizationPanel = ({ isOpen, onClose }) => {
  const { font, setFont } = useTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="panel-overlay"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="personalization-panel glass-card"
          >
            <div className="panel-header">
              <h2>Customize Typography</h2>
              <button onClick={onClose} className="close-btn"><FiX /></button>
            </div>

            <div className="panel-section">
              <h3><FiType /> Font Selection</h3>
              <p className="section-desc">Choose a typeface that feels most comfortable for you.</p>
              <div className="font-options">
                {[
                  { id: 'inter', name: 'Inter', desc: 'Clean & Default' },
                  { id: 'poppins', name: 'Poppins', desc: 'Soft & Friendly' },
                  { id: 'opendyslexic', name: 'OpenDyslexic', desc: 'High Legibility' }
                ].map((f) => (
                  <button
                    key={f.id}
                    className={`font-option ${font === f.id ? 'active' : ''}`}
                    onClick={() => setFont(f.id)}
                  >
                    <div className="font-info">
                      <span 
                        className="font-name" 
                        style={{ fontFamily: f.id === 'opendyslexic' ? 'OpenDyslexic' : f.id === 'poppins' ? 'Poppins' : 'Inter' }}
                      >
                        {f.name}
                      </span>
                      <span className="font-desc">{f.desc}</span>
                    </div>
                    {font === f.id && <FiCheck className="check-icon" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-footer">
              <p>Your preference is automatically saved to your device.</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PersonalizationPanel;
