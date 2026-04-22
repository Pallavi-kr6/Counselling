/**
 * CounsellorSessionDetail.js - EXAMPLE
 * Example of integrating Cancel & Reassign feature
 * This shows how to add cancel button and modals to existing session pages
 * 
 * Replace YOUR_EXISTING_PAGE with your actual page component
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiAlertCircle, FiBell, FiClock } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import CancelSessionModal from '../components/CancelSessionModal';
import StudentConfirmationModal from '../components/StudentConfirmationModal';
import NotificationCenter from '../components/NotificationCenter';
import './CounsellorSessionDetail.css';

const CounsellorSessionDetail = ({ sessionId }) => {
  const { user, notifications: socketNotifications } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);

  // Related notifications
  const [confirmationNotif, setConfirmationNotif] = useState(null);

  useEffect(() => {
    fetchSessionDetails();
  }, [sessionId]);

  // Check for incoming confirmation notifications
  useEffect(() => {
    const notif = socketNotifications?.find(
      (n) => n.type === 'counsellor_accepted' && n.data?.session_id === sessionId
    );
    setConfirmationNotif(notif);
  }, [socketNotifications, sessionId]);

  const fetchSessionDetails = async () => {
    try {
      const response = await api.get(`/sessions/${sessionId}/status`);
      setSession(response.data.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading session details...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!session) {
    return <div className="error">Session not found</div>;
  }

  const canCancel = ['scheduled', 'confirmed', 'pending_student_confirmation'].includes(
    session.status
  );

  const statusColor = {
    scheduled: 'blue',
    confirmed: 'green',
    cancelled_by_counsellor: 'red',
    pending_counsellor_acceptance: 'yellow',
    pending_student_confirmation: 'purple',
    needs_reschedule: 'orange',
    completed: 'gray'
  };

  return (
    <motion.div
      className="session-detail-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header with notification bell */}
      <div className="session-header">
        <div>
          <h1>Session Details</h1>
          <p>Manage and monitor this counselling session</p>
        </div>
        
        <button
          className="notification-bell"
          onClick={() => setShowNotificationCenter(!showNotificationCenter)}
          title="View notifications"
        >
          <FiBell />
          {socketNotifications?.length > 0 && (
            <span className="badge">{socketNotifications.length}</span>
          )}
        </button>
      </div>

      {/* Notification center drawer */}
      {showNotificationCenter && (
        <motion.div
          className="notification-drawer"
          initial={{ x: 400 }}
          animate={{ x: 0 }}
          exit={{ x: 400 }}
        >
          <div className="drawer-header">
            <h3>Notifications</h3>
            <button onClick={() => setShowNotificationCenter(false)}>
              <FiX />
            </button>
          </div>
          <NotificationCenter />
        </motion.div>
      )}

      {/* Main content */}
      <div className="session-content">
        {/* Session Status Card */}
        <motion.div
          className={`status-card status-${statusColor[session.status]}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="status-header">
            <h2>Status</h2>
            <span className={`status-badge status-${statusColor[session.status]}`}>
              {session.status?.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>

          {session.status === 'needs_reschedule' && (
            <div className="alert-warning">
              <FiAlertCircle />
              <p>This session needs to be rescheduled. No counsellors were available.</p>
            </div>
          )}

          {session.status === 'pending_counsellor_acceptance' && (
            <div className="alert-info">
              <FiBell />
              <p>Waiting for replacement counsellor to accept...</p>
              {session.replacement_candidates?.length > 0 && (
                <p className="candidates-info">
                  {session.replacement_candidates.length} candidate(s) being contacted
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* Session Information Card */}
        <motion.div
          className="info-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3>Session Information</h3>

          <div className="info-grid">
            <div className="info-item">
              <span className="label">Date</span>
              <span className="value">
                {new Date(session.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>

            <div className="info-item">
              <span className="label">Time</span>
              <span className="value">
                <FiClock /> {session.start_time} - {session.end_time}
              </span>
            </div>

            <div className="info-item">
              <span className="label">Student ID</span>
              <span className="value">{session.student_id?.slice(-8)}</span>
            </div>

            <div className="info-item">
              <span className="label">Current Counsellor</span>
              <span className="value">
                {session.counsellor_id ? session.counsellor_id.slice(-8) : 'Not assigned'}
              </span>
            </div>

            {session.cancellation_reason && (
              <div className="info-item full-width">
                <span className="label">Cancellation Reason</span>
                <span className="value reason-text">{session.cancellation_reason}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Replacement Candidates (if any) */}
        {session.replacement_candidates?.length > 0 && (
          <motion.div
            className="candidates-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3>Replacement Candidates</h3>
            <div className="candidates-list">
              {session.replacement_candidates.map((candidateId, index) => (
                <div
                  key={candidateId}
                  className={`candidate-item ${
                    index === session.current_candidate_index ? 'current' : ''
                  }`}
                >
                  <div className="candidate-number">#{index + 1}</div>
                  <div className="candidate-info">
                    <span className="name">Candidate {index + 1}</span>
                    <span className="id">{candidateId.slice(-8)}</span>
                  </div>
                  {index === session.current_candidate_index && (
                    <span className="badge current-badge">Currently Contacted</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Timeline/Audit Log */}
        <motion.div
          className="audit-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3>Session Timeline</h3>
          <div className="timeline">
            <div className="timeline-item">
              <span className="time">Created</span>
              <span className="date">
                {new Date(session.created_at).toLocaleString()}
              </span>
            </div>

            {session.cancelled_at && (
              <div className="timeline-item cancelled">
                <span className="time">Cancelled</span>
                <span className="date">
                  {new Date(session.cancelled_at).toLocaleString()}
                </span>
              </div>
            )}

            {session.student_confirmed_at && (
              <div className="timeline-item confirmed">
                <span className="time">Student Confirmed</span>
                <span className="date">
                  {new Date(session.student_confirmed_at).toLocaleString()}
                </span>
              </div>
            )}

            <div className="timeline-item last">
              <span className="time">Last Updated</span>
              <span className="date">
                {new Date(session.updated_at).toLocaleString()}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          className="actions-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3>Actions</h3>

          {canCancel ? (
            <button
              className="btn btn-danger"
              onClick={() => setShowCancelModal(true)}
            >
              Cancel This Session
            </button>
          ) : (
            <p className="disabled-note">
              This session cannot be cancelled in its current status.
            </p>
          )}
        </motion.div>
      </div>

      {/* Cancel Session Modal */}
      <CancelSessionModal
        isOpen={showCancelModal}
        session={session}
        onClose={() => setShowCancelModal(false)}
        onSuccess={(result) => {
          fetchSessionDetails(); // Refresh session data
          console.log('Session cancelled:', result);
        }}
      />

      {/* Student Confirmation Modal (if notification exists) */}
      <StudentConfirmationModal
        isOpen={!!confirmationNotif}
        notification={confirmationNotif}
        onClose={() => setConfirmationNotif(null)}
        onSuccess={(result) => {
          fetchSessionDetails();
          console.log('Student confirmation result:', result);
        }}
      />
    </motion.div>
  );
};

export default CounsellorSessionDetail;
