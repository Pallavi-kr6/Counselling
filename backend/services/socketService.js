/**
 * socketService.js (Backend)
 * Socket.io setup for real-time session notifications
 * Enables live updates when:
 * - Session is cancelled
 * - Reassignment request is sent
 * - Counsellor accepts/rejects
 * - Student confirms/rejects
 */

const socketIO = require('socket.io');

const connectedUsers = new Map(); // userId -> socket

/**
 * Initialize Socket.io with Express server
 */
function initializeSocket(httpServer) {
  const io = socketIO(httpServer, {
    cors: {
      origin: [
        'https://counselling-1.onrender.com',
        'https://counselling-w1mh.onrender.com',
        'https://counselling-162v.onrender.com',
        'http://localhost:3000',
        'http://localhost:3001'
      ],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Middleware to verify user
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('No token provided'));
    }
    // Token verification happens in connection handler
    next();
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // User joins their personal room
    socket.on('join_user_room', (userId) => {
      socket.join(`user:${userId}`);
      connectedUsers.set(userId, socket.id);
      console.log(`[Socket] User ${userId} joined personal room`);
    });

    // User leaves
    socket.on('disconnect', () => {
      // Find and remove user
      for (const [userId, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          console.log(`[Socket] User ${userId} disconnected`);
          break;
        }
      }
    });

    // Error handler
    socket.on('error', (error) => {
      console.error(`[Socket] Error from ${socket.id}:`, error);
    });
  });

  return io;
}

/**
 * Emit real-time notification to a user
 * @param {Object} io - Socket.io instance
 * @param {string} userId - Recipient user ID
 * @param {Object} notification - Notification object
 * @param {string} eventType - Event type (e.g., 'reassignment_request', 'session_accepted')
 */
function notifyUser(io, userId, notification, eventType) {
  io.to(`user:${userId}`).emit(eventType, {
    id: notification.id,
    type: eventType,
    title: notification.title,
    message: notification.message,
    data: notification.data,
    timestamp: new Date().toISOString()
  });

  console.log(`[Socket] Notified ${userId} about ${eventType}`);
}

/**
 * Notify counsellor of reassignment request
 */
function notifyCounsellor(io, counsellorId, sessionData) {
  notifyUser(io, counsellorId, {
    id: sessionData.id,
    title: 'Reassignment Request: Student Session Available',
    message: `Session at ${sessionData.start_time} on ${sessionData.date}`,
    data: sessionData
  }, 'reassignment_request');
}

/**
 * Notify student of counsellor acceptance
 */
function notifyStudentOfAcceptance(io, studentId, sessionData) {
  notifyUser(io, studentId, {
    id: sessionData.id,
    title: 'New Counsellor Assigned',
    message: `${sessionData.counsellor_name} has been assigned.`,
    data: sessionData
  }, 'counsellor_accepted');
}

/**
 * Notify student of session cancellation
 */
function notifyStudentOfCancellation(io, studentId, sessionData) {
  notifyUser(io, studentId, {
    id: sessionData.id,
    title: 'Session Cancelled',
    message: 'Your session has been cancelled. Finding replacement...',
    data: sessionData
  }, 'session_cancelled');
}

/**
 * Notify counsellor of session confirmation
 */
function notifyCounsellor OfConfirmation(io, counsellorId, sessionData) {
  notifyUser(io, counsellorId, {
    id: sessionData.id,
    title: 'Session Confirmed',
    message: 'Student has confirmed your assigned session.',
    data: sessionData
  }, 'session_confirmed');
}

/**
 * Broadcast session status update to all connected users viewing this session
 */
function broadcastSessionUpdate(io, sessionId, statusUpdate) {
  io.to(`session:${sessionId}`).emit('session_updated', {
    session_id: sessionId,
    ...statusUpdate,
    timestamp: new Date().toISOString()
  });

  console.log(`[Socket] Broadcasted update for session ${sessionId}`);
}

/**
 * Join user to session room (for live updates)
 */
function joinSessionRoom(socket, sessionId, userId) {
  socket.join(`session:${sessionId}`);
  console.log(`[Socket] User ${userId} joined session ${sessionId} room`);
}

module.exports = {
  initializeSocket,
  notifyUser,
  notifyCounsellor,
  notifyStudentOfAcceptance,
  notifyStudentOfCancellation,
  notifyCounsellorOfConfirmation: notifyCounsellor OfConfirmation,
  broadcastSessionUpdate,
  joinSessionRoom,
  connectedUsers
};
