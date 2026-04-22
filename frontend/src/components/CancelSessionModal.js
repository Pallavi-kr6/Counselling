/**
 * CancelSessionModal.js
 * Modal for counsellor to cancel a session
 * Shows confirmation dialog and sends cancel request to backend
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertTriangle, FiX, FiCheckCircle } from 'react-icons/fi';
import api from '../utils/api';
import './CancelSessionModal.css';

const CancelSessionModal = ({ isOpen, session, onClose, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleCancel = async () => {
    if (!session) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.post(`/sessions/${session.id}/cancel`, {
        reason: reason.trim()
      });

      setResult(response.data.data);

      // Auto-close after 3 seconds
      setTimeout(() => {
        onClose();
        onSuccess?.(response.data.data);
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel session');
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay" onClick={onClose}>
          <motion.div
            className="modal-content cancel-session-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="modal-header">
              <h2>Cancel Session</h2>
              <button className="close-btn" onClick={onClose}>
                <FiX />
              </button>
            </div>

            {result ? (
              // Success state
              <motion.div
                className="result-container success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="success-icon">
                  <FiCheckCircle />
                </div>
                <h3>Session Cancelled Successfully</h3>
                <div className="result-details">
                  <p><strong>Status:</strong> {result.status}</p>
                  <p><strong>Message:</strong> {result.message}</p>
                  {result.firstCandidate && (
                    <p><strong>First Candidate:</strong> {result.firstCandidate.name}</p>
                  )}
                </div>
                <p className="success-note">The first replacement counsellor has been notified.</p>
              </motion.div>
            ) : (
              // Confirmation state
              <>
                <div className="modal-body">
                  <div className="warning-box">
                    <FiAlertTriangle className="warning-icon" />
                    <div>
                      <p className="warning-title">Are you sure you want to cancel this session?</p>
                      <p className="warning-text">The student will be notified, and we'll attempt to find a replacement counsellor.</p>
                    </div>
                  </div>

                  <div className="session-info">
                    <h4>Session Details:</h4>
                    <div className="info-row">
                      <span className="label">Date:</span>
                      <span className="value">{new Date(session.date).toLocaleDateString()}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Time:</span>
                      <span className="value">{session.start_time} - {session.end_time}</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="reason">Reason for Cancellation (Optional)</label>
                    <textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="E.g., Emergency, Illness, Unable to continue..."
                      maxLength={200}
                      disabled={loading}
                    />
                    <small className="char-count">{reason.length}/200</small>
                  </div>

                  {error && (
                    <motion.div
                      className="alert-error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Keep Session
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    {loading ? 'Cancelling...' : 'Cancel Session'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CancelSessionModal;
