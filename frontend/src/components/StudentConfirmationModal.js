/**
 * StudentConfirmationModal.js
 * Modal for student to confirm or reject new counsellor
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import api from '../utils/api';
import './StudentConfirmationModal.css';

const StudentConfirmationModal = ({ isOpen, notification, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReasonForm, setShowReasonForm] = useState(false);

  if (!notification || !notification.session_id) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.post(`/sessions/${notification.session_id}/student-response`, {
        response: 'accept'
      });
      await api.post(`/sessions/notification/${notification.id}/read`).catch(() => {});

      setResult({
        type: 'confirmed',
        data: response.data.data
      });

      setTimeout(() => {
        onClose();
        onSuccess?.({ type: 'confirmed', data: response.data.data });
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm session');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.post(`/sessions/${notification.session_id}/student-response`, {
        response: 'reject'
      });
      await api.post(`/sessions/notification/${notification.id}/read`).catch(() => {});

      setResult({
        type: 'rejected',
        data: response.data.data
      });

      setTimeout(() => {
        onClose();
        onSuccess?.({ type: 'rejected', data: response.data.data });
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay" onClick={onClose}>
          <motion.div
            className="modal-content student-confirmation-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="modal-header">
              <h2>New Counsellor Assignment</h2>
              <button className="close-btn" onClick={onClose}>
                <FiX />
              </button>
            </div>

            {result ? (
              // Result state
              <motion.div
                className="result-container"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className={`result-icon ${result.type}`}>
                  {result.type === 'confirmed' ? <FiCheckCircle /> : <FiAlertCircle />}
                </div>
                <h3>
                  {result.type === 'confirmed'
                    ? 'Session Confirmed'
                    : 'Request Rejected'}
                </h3>
                <p className="result-message">
                  {result.type === 'confirmed'
                    ? 'We have asked the counsellor to confirm this session.'
                    : 'Request rejected. No meeting has been scheduled.'}
                </p>
              </motion.div>
            ) : (
              // Confirmation state
              <>
                <div className="modal-body">
                  <div className="info-box">
                    <div className="info-icon">
                      <FiAlertCircle />
                    </div>
                    <div className="info-content">
                      <p className="info-title">Your original counsellor has cancelled.</p>
                      <p className="info-text">
                        {notification.data?.counsellor_name || 'Another counsellor'} is available for another slot. Would you like to continue with them?
                      </p>
                    </div>
                  </div>

                  <div className="counsellor-info">
                    <h4>New Counsellor Assignment</h4>
                    <div className="info-row">
                      <span className="label">Date:</span>
                      <span className="value">
                        {notification.data?.date && new Date(notification.data.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">Day Order:</span>
                      <span className="value">{notification.data?.day_order_name || 'Available day order'}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Time:</span>
                      <span className="value">
                        {notification.data?.start_time} - {notification.data?.end_time}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">Counsellor:</span>
                      <span className="value">{notification.data?.counsellor_name || 'TBD'}</span>
                    </div>
                  </div>

                  {!showReasonForm ? (
                    <div className="quick-actions">
                      <p className="action-prompt">What would you like to do?</p>
                      <div className="button-group">
                        <button
                          className="btn btn-secondary"
                          onClick={() => setShowReasonForm(true)}
                          disabled={loading}
                        >
                          No, Reject
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={handleConfirm}
                          disabled={loading}
                        >
                          {loading ? 'Confirming...' : 'Yes, Proceed'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="reason-form">
                      <label htmlFor="reason">
                        Reason for rejecting (Optional)
                      </label>
                      <textarea
                        id="reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="E.g., Not comfortable with new counsellor, scheduling conflict..."
                        maxLength={200}
                        disabled={loading}
                      />
                      <small className="char-count">{rejectionReason.length}/200</small>

                      <div className="form-actions">
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowReasonForm(false);
                            setRejectionReason('');
                          }}
                          disabled={loading}
                        >
                          Go Back
                        </button>
                        <button
                          className="btn btn-warning"
                          onClick={handleReject}
                          disabled={loading}
                        >
                          {loading ? 'Processing...' : 'Reject Request'}
                        </button>
                      </div>
                    </div>
                  )}

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
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default StudentConfirmationModal;
