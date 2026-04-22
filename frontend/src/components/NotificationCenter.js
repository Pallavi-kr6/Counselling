/**
 * NotificationCenter.js
 * Main notification center for counsellors to view and manage notifications
 * Shows reassignment requests, confirmations, and other session events
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiTrash2, FiCheckCircle } from 'react-icons/fi';
import api from '../utils/api';
import ReassignmentNotificationCard from './ReassignmentNotificationCard';
import './NotificationCenter.css';

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterType, setFilterType] = useState('action-required'); // 'action-required', 'all', 'read'

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 10 seconds
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [filterType]);

  const fetchNotifications = async () => {
    try {
      let response;

      if (filterType === 'action-required') {
        response = await api.get('/sessions/user/action-required');
        setNotifications(response.data.data);
        setUnreadCount(response.data.count);
      } else {
        const includeRead = filterType === 'all' ? 'true' : 'false';
        response = await api.get(`/sessions/user/notifications?includeRead=${includeRead}`);
        setNotifications(response.data.data);
      }

      setError('');
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.post(`/sessions/notification/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await api.delete(`/sessions/notification/${notificationId}`);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/sessions/user/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleNotificationAction = (notification) => {
    // After accept/reject, mark as read and remove from action-required
    handleMarkAsRead(notification.id);
  };

  if (loading) {
    return (
      <div className="notification-center">
        <div className="loading-state">
          <FiBell className="loading-icon" />
          <p>Loading notifications...</p>
        </div>
      </div>
    );
  }

  const actionRequiredNotifications = notifications.filter(
    (n) => n.action_required && !n.is_read
  );

  return (
    <div className="notification-center">
      <div className="center-header">
        <div className="header-top">
          <h2>
            <FiBell />
            Notifications
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </h2>
          {unreadCount > 0 && (
            <button className="mark-all-btn" onClick={handleMarkAllAsRead}>
              <FiCheckCircle /> Mark all as read
            </button>
          )}
        </div>

        <div className="filter-tabs">
          <button
            className={`tab ${filterType === 'action-required' ? 'active' : ''}`}
            onClick={() => {
              setFilterType('action-required');
              setLoading(true);
            }}
          >
            Action Required
            {actionRequiredNotifications.length > 0 && (
              <span className="tab-badge">{actionRequiredNotifications.length}</span>
            )}
          </button>
          <button
            className={`tab ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => {
              setFilterType('all');
              setLoading(true);
            }}
          >
            All
          </button>
          <button
            className={`tab ${filterType === 'read' ? 'active' : ''}`}
            onClick={() => {
              setFilterType('read');
              setLoading(true);
            }}
          >
            Read
          </button>
        </div>
      </div>

      {error && (
        <motion.div className="alert-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {error}
        </motion.div>
      )}

      <div className="notifications-list">
        {notifications.length === 0 ? (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <FiBell className="empty-icon" />
            <p>No {filterType === 'action-required' ? 'pending' : 'new'} notifications</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                className="notification-item"
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {notif.notification_type === 'reassignment_request' ? (
                  <ReassignmentNotificationCard
                    notification={notif}
                    onAccept={() => handleNotificationAction(notif)}
                    onReject={() => handleNotificationAction(notif)}
                  />
                ) : (
                  <div className="notification-card">
                    <div className="card-content">
                      <div className="card-title">{notif.title}</div>
                      <div className="card-message">{notif.message}</div>
                      <div className="card-time">
                        {new Date(notif.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="card-actions">
                      {!notif.is_read && (
                        <button
                          className="action-btn mark-read"
                          onClick={() => handleMarkAsRead(notif.id)}
                          title="Mark as read"
                        >
                          <FiCheckCircle />
                        </button>
                      )}
                      <button
                        className="action-btn delete"
                        onClick={() => handleDelete(notif.id)}
                        title="Delete notification"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
