/**
 * ReassignmentNotificationCard.js
 * Displays a reassignment request to a counsellor
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiBell, FiCheck, FiX } from 'react-icons/fi';
import api from '../utils/api';
import './ReassignmentNotificationCard.css';

const ReassignmentNotificationCard = ({ notification, onAccept, onReject }) => {
  const [loading, setLoading] = useState(false);
  const [responded, setResponded] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post(`/sessions/${notification.session_id}/counsellor-response`, {
        response: 'accept'
      });
      await api.post(`/sessions/notification/${notification.id}/read`).catch(() => {});
      setResponded(true);
      onAccept?.(notification);
    } catch (error) {
      console.error('Error accepting reassignment:', error);
      setError(error.response?.data?.error || 'Unable to accept this reassignment.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post(`/sessions/${notification.session_id}/counsellor-response`, {
        response: 'reject'
      });
      await api.post(`/sessions/notification/${notification.id}/read`).catch(() => {});
      setResponded(true);
      onReject?.(notification);
    } catch (error) {
      console.error('Error rejecting reassignment:', error);
      setError(error.response?.data?.error || 'Unable to reject this reassignment.');
    } finally {
      setLoading(false);
    }
  };

  if (responded) {
    return (
      <motion.div
        className="notification-card responded"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, x: -100 }}
      >
        <div className="responded-message">
          Response submitted. Thank you!
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="reassignment-card"
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="card-header">
        <div className="header-left">
          <div className="bell-icon">
            <FiBell />
          </div>
          <div>
            <h3 className="card-title">{notification.title}</h3>
            <p className="card-message">{notification.message}</p>
          </div>
        </div>
      </div>

      <div className="card-details">
        {notification.data?.student_name && (
          <div className="detail-item">
            <span className="detail-label">Student:</span>
            <span className="detail-value">{notification.data.student_name}</span>
          </div>
        )}
        <div className="detail-item">
          <span className="detail-label">Date:</span>
          <span className="detail-value">
            {notification.data?.date && new Date(notification.data.date).toLocaleDateString()}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Time:</span>
          <span className="detail-value">
            {notification.data?.start_time} - {notification.data?.end_time}
          </span>
        </div>
      </div>

      <div className="card-actions">
        <button
          className="btn-action btn-reject"
          onClick={handleReject}
          disabled={loading}
        >
          <FiX /> Reject
        </button>
        <button
          className="btn-action btn-accept"
          onClick={handleAccept}
          disabled={loading}
        >
          <FiCheck /> Accept
        </button>
      </div>

      {error && <div className="expired-banner">{error}</div>}
    </motion.div>
  );
};

export default ReassignmentNotificationCard;
