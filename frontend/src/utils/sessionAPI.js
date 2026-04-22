/**
 * sessionAPI.js
 * Centralized API client for session management
 * Usage: import { cancelSession, acceptSession, etc. } from '../utils/sessionAPI'
 */

import api from './api';

/**
 * Cancel session by counsellor
 */
export const cancelSession = async (sessionId, reason = '') => {
  try {
    const response = await api.post(`/sessions/${sessionId}/cancel`, { reason });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to cancel session'
    };
  }
};

/**
 * Accept reassignment (counsellor)
 */
export const acceptReassignment = async (sessionId) => {
  try {
    const response = await api.post(`/sessions/${sessionId}/counsellor-response`, {
      response: 'accept'
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to accept reassignment'
    };
  }
};

/**
 * Reject reassignment (counsellor)
 */
export const rejectReassignment = async (sessionId, reason = '') => {
  try {
    const response = await api.post(`/sessions/${sessionId}/counsellor-response`, {
      response: 'reject',
      reason
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to reject reassignment'
    };
  }
};

/**
 * Student confirms new counsellor
 */
export const confirmSession = async (sessionId) => {
  try {
    const response = await api.post(`/sessions/${sessionId}/student-response`, {
      response: 'accept'
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to confirm session'
    };
  }
};

/**
 * Student rejects new counsellor
 */
export const rejectSession = async (sessionId, reason = '') => {
  try {
    const response = await api.post(`/sessions/${sessionId}/student-response`, {
      response: 'reject',
      reason
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to reject session'
    };
  }
};

/**
 * Get session status
 */
export const getSessionStatus = async (sessionId) => {
  try {
    const response = await api.get(`/sessions/${sessionId}/status`);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to get session status'
    };
  }
};

/**
 * Get session audit log
 */
export const getSessionAuditLog = async (sessionId) => {
  try {
    const response = await api.get(`/sessions/${sessionId}/audit`);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to get audit log'
    };
  }
};

/**
 * Get notifications
 */
export const getNotifications = async (includeRead = false, limit = 50) => {
  try {
    const response = await api.get(
      `/sessions/user/notifications?includeRead=${includeRead}&limit=${limit}`
    );
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to get notifications'
    };
  }
};

/**
 * Get action-required notifications
 */
export const getActionRequiredNotifications = async () => {
  try {
    const response = await api.get('/sessions/user/action-required');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to get action notifications'
    };
  }
};

/**
 * Get unread count
 */
export const getUnreadCount = async () => {
  try {
    const response = await api.get('/sessions/user/unread-count');
    return { success: true, count: response.data.count };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to get unread count',
      count: 0
    };
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const response = await api.post(`/sessions/notification/${notificationId}/read`);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to mark notification as read'
    };
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async () => {
  try {
    const response = await api.post('/sessions/user/mark-all-read');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to mark all as read'
    };
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId) => {
  try {
    const response = await api.delete(`/sessions/notification/${notificationId}`);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to delete notification'
    };
  }
};

/**
 * Get pending reassignments for counsellor
 */
export const getPendingReassignments = async (counsellorId) => {
  try {
    const response = await api.get(`/sessions/counsellor/${counsellorId}/pending`);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to get pending reassignments'
    };
  }
};
