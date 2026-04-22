const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./auth');
const sessionService = require('../services/sessionService');
const notificationService = require('../services/notificationService');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getCurrentUserId(req) {
  return req.user?.userId || req.user?.id;
}

async function handleCounsellorResponseRequest(req, res, responseValue) {
  try {
    const counsellorId = getCurrentUserId(req);

    if (req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Only counsellors can respond to reassignment requests' });
    }

    const result = await sessionService.handleCounsellorResponse(req.params.id, counsellorId, responseValue);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Counsellor response error:', error);
    return res.status(400).json({ error: error.message });
  }
}

async function handleStudentResponseRequest(req, res, responseValue) {
  try {
    const studentId = getCurrentUserId(req);

    if (req.user.userType !== 'student') {
      return res.status(403).json({ error: 'Only students can respond to reassignment offers' });
    }

    const result = await sessionService.handleStudentResponse(req.params.id, studentId, responseValue);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Student response error:', error);
    return res.status(400).json({ error: error.message });
  }
}

router.post('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const counsellorId = getCurrentUserId(req);
    const { reason = '' } = req.body;

    if (req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Only counsellors can cancel sessions' });
    }

    const result = await sessionService.cancelSessionByCounsellor(req.params.id, counsellorId, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/counsellor-response', verifyToken, async (req, res) => {
  return handleCounsellorResponseRequest(req, res, req.body.response);
});

router.post('/:id/student-response', verifyToken, async (req, res) => {
  return handleStudentResponseRequest(req, res, req.body.response);
});

// Compatibility aliases for the existing frontend components.
router.post('/:id/accept', verifyToken, async (req, res) => {
  return handleCounsellorResponseRequest(req, res, 'accept');
});

router.post('/:id/reject', verifyToken, async (req, res) => {
  return handleCounsellorResponseRequest(req, res, 'reject');
});

router.post('/:id/student-confirm', verifyToken, async (req, res) => {
  return handleStudentResponseRequest(req, res, 'accept');
});

router.post('/:id/student-reject', verifyToken, async (req, res) => {
  return handleStudentResponseRequest(req, res, 'reject');
});

router.get('/counsellor/:counsellorId/pending', verifyToken, async (req, res) => {
  try {
    const requesterId = getCurrentUserId(req);
    const { counsellorId } = req.params;

    if (requesterId !== counsellorId && req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const notifications = await notificationService.getActionNotifications(counsellorId);
    const pending = notifications.filter((notification) => notification.notification_type === 'reassignment_request');

    res.json({ success: true, data: pending });
  } catch (error) {
    console.error('Get counsellor pending sessions error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/status', verifyToken, async (req, res) => {
  try {
    const { data: session, error } = await supabase
      .from('appointments')
      .select(`
        id,
        date,
        start_time,
        end_time,
        status,
        student_id,
        counsellor_id,
        reassigned_counsellor_id,
        counsellor_approved,
        student_approved,
        reassignment_attempted_counsellor_ids,
        notes,
        updated_at,
        created_at
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      throw error;
    }

    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Get session status error:', error);
    res.status(404).json({ error: 'Session not found' });
  }
});

router.get('/:id/audit', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('session_audit_log')
      .select('*')
      .eq('session_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Get session audit error:', error);
    res.status(400).json({ error: 'Failed to load session audit log' });
  }
});

router.get('/user/notifications', verifyToken, async (req, res) => {
  try {
    const notifications = await notificationService.getNotifications(getCurrentUserId(req), {
      includeRead: req.query.includeRead === 'true',
      limit: Number(req.query.limit || 50)
    });

    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/user/action-required', verifyToken, async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    const [notifications, count] = await Promise.all([
      notificationService.getActionNotifications(userId),
      notificationService.getActionRequiredCount(userId)
    ]);

    res.json({ success: true, data: notifications, count });
  } catch (error) {
    console.error('Get action-required notifications error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/user/unread-count', verifyToken, async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(getCurrentUserId(req));
    res.json({ success: true, count });
  } catch (error) {
    console.error('Get unread notification count error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/notification/:notificationId/read', verifyToken, async (req, res) => {
  try {
    await notificationService.markAsRead(req.params.notificationId);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/user/mark-all-read', verifyToken, async (req, res) => {
  try {
    await notificationService.markAllAsRead(getCurrentUserId(req));
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.delete('/notification/:notificationId', verifyToken, async (req, res) => {
  try {
    await notificationService.deleteNotification(req.params.notificationId);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/maintenance/cleanup-notifications', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const count = await notificationService.cleanupExpiredNotifications();
    res.json({ success: true, message: `Cleaned up ${count} expired notifications` });
  } catch (error) {
    console.error('Cleanup notifications error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
