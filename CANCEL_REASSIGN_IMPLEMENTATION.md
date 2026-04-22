# Cancel & Reassign Session Feature - Implementation Guide

## 📋 Overview

This document provides step-by-step instructions for implementing the **Cancel & Reassign Session** feature with real-time notifications and race condition prevention.

---

## 🔧 Installation & Setup

### 1. Install Dependencies

```bash
cd backend
npm install socket.io
```

```bash
cd frontend
npm install socket.io-client
```

### 2. Run Database Migration

Execute the schema migration to add new tables and functions:

```sql
-- Run in Supabase SQL Editor or psql
-- File: supabase/schema_sessions_migration.sql
```

**Key changes:**
- Adds `status`, `replacement_candidates`, `version` fields to `appointments` table
- Creates `notifications` table for persistent notifications
- Creates `session_audit_log` table for tracking changes
- Adds `find_available_counsellors` SQL function
- Creates indices for performance

---

## 🏗️ Backend Integration

### 1. Update Main Server File

In `backend/index.js`:

```javascript
const http = require('http');
const socketService = require('./services/socketService');

// Create HTTP server (needed for Socket.io)
const server = http.createServer(app);
const io = socketService.initializeSocket(server);

// Pass io to services/routes if needed
app.locals.io = io;

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 2. Update Session Service to Emit Events

In `backend/services/sessionService.js`, add Socket.io emissions:

```javascript
const socketService = require('./socketService');

async function cancelSessionByCounsellor(sessionId, counsellorId, reason = '', io = null) {
  // ... existing code ...
  
  // After finding candidates and updating session:
  if (io && firstCandidate) {
    socketService.notifyCounsellor(io, firstCandidate.counsellor_id, {
      id: sessionId,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time
    });
  }
  
  // ... rest of code ...
}
```

### 3. Mount Sessions Routes

In `backend/index.js`, the route is already added:

```javascript
app.use('/api/sessions', require('./routes/sessions'));
```

### 4. Pass io Instance to Routes

Modify `backend/routes/sessions.js` to accept and use `io`:

```javascript
router.post('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const io = req.app.locals.io;
    const result = await sessionService.cancelSessionByCounsellor(
      sessionId,
      counsellorId,
      reason,
      io // Pass io instance
    );
    // ... rest of code ...
  }
});
```

---

## 🖥️ Frontend Integration

### 1. Setup Socket.io in AuthContext

Add Socket.io connection to your `frontend/src/context/AuthContext.js`:

```javascript
import { useSocket } from './useSocket';

export const AuthProvider = ({ children }) => {
  // ... existing auth code ...
  const { socket, notifications, isConnected } = useSocket();

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      socket, 
      notifications, 
      isConnected 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 2. Add Cancel Button to Session Card

In your counsellor session component:

```javascript
import CancelSessionModal from './CancelSessionModal';
import { useState } from 'react';

export function SessionCard({ session }) {
  const [showCancelModal, setShowCancelModal] = useState(false);

  return (
    <div className="session-card">
      {/* Session details */}
      <button onClick={() => setShowCancelModal(true)}>
        Cancel Session
      </button>
      
      <CancelSessionModal
        isOpen={showCancelModal}
        session={session}
        onClose={() => setShowCancelModal(false)}
        onSuccess={(result) => {
          // Refresh sessions list
          console.log('Session cancelled:', result);
        }}
      />
    </div>
  );
}
```

### 3. Display Notification Center for Counsellors

In your counsellor dashboard:

```javascript
import NotificationCenter from './NotificationCenter';

export function CounsellorDashboard() {
  const { user } = useAuth();

  if (user.userType !== 'counsellor') return null;

  return (
    <div className="dashboard">
      <NotificationCenter />
      {/* Other dashboard content */}
    </div>
  );
}
```

### 4. Handle Student Confirmation

In your student appointment view:

```javascript
import StudentConfirmationModal from './StudentConfirmationModal';
import { useAuth } from '../context/AuthContext';

export function StudentAppointment({ appointment }) {
  const { notifications } = useAuth();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const studentConfirmationNotif = notifications.find(
    n => n.type === 'counsellor_accepted' && n.data?.id === appointment.id
  );

  useEffect(() => {
    if (studentConfirmationNotif) {
      setShowConfirmModal(true);
    }
  }, [studentConfirmationNotif]);

  return (
    <>
      <StudentConfirmationModal
        isOpen={showConfirmModal}
        notification={studentConfirmationNotif}
        onClose={() => setShowConfirmModal(false)}
        onSuccess={(result) => {
          console.log('Session confirmation result:', result);
        }}
      />
    </>
  );
}
```

---

## 🔒 Race Condition Prevention

### How It Works

1. **Optimistic Locking with Version Field**
   - Each session has a `version` field
   - Before updating, check: `WHERE version = current_version`
   - If someone else updated it, the update fails
   - Retry logic can be added for automatic retries

2. **Status Validation**
   - Before each action (accept/reject/confirm), validate current status
   - Only allow transitions from valid states
   - Example: Can only accept when status = 'pending_counsellor_acceptance'

3. **Atomic Operations**
   - Session update and notification creation happen in single transaction
   - If notification fails, session update is visible but notif retry happens

### Example: Handling Concurrent Accepts

```
Time 0: Counsellor A loads session (version=1, status=pending)
Time 0: Counsellor B loads same session (version=1, status=pending)
Time 1: Counsellor A clicks accept
        UPDATE appointments SET version=2, status=confirmed WHERE id=X AND version=1
        Success! Now version=2
Time 2: Counsellor B clicks accept
        UPDATE appointments SET version=2, status=confirmed WHERE id=X AND version=1
        FAILS! (version != 1)
        Return error: "Session already accepted by another counsellor"
```

---

## 🎯 Testing Scenarios

### Test Case 1: Basic Cancellation & Reassignment

1. Counsellor A has a session with Student S
2. Counsellor A clicks "Cancel Session"
3. System finds available Counsellor B
4. Counsellor B receives reassignment notification
5. Counsellor B accepts
6. Student S receives confirmation request
7. Student S accepts
8. Session now has Counsellor B

### Test Case 2: No Counsellors Available

1. Session is cancelled
2. No other counsellors are free at that time
3. Session status → "needs_reschedule"
4. Student receives notification to reschedule

### Test Case 3: Concurrent Acceptances (Race Condition)

1. Two counsellors receive the same reassignment request
2. Both click "Accept" at almost same time
3. First one succeeds (version check passes)
4. Second one gets error: "Session already accepted"
5. UI shows appropriate error message

### Test Case 4: Rejection Cascade

1. Counsellor B rejects the reassignment
2. System moves to next candidate (Counsellor C)
3. Counsellor C receives notification
4. Process continues until acceptance or no more candidates

---

## 🔄 API Endpoints Summary

### Session Management

```
POST   /api/sessions/:id/cancel              - Counsellor cancels session
POST   /api/sessions/:id/accept              - Counsellor accepts reassignment
POST   /api/sessions/:id/reject              - Counsellor rejects reassignment
POST   /api/sessions/:id/student-confirm     - Student confirms new counsellor
POST   /api/sessions/:id/student-reject      - Student rejects new counsellor
GET    /api/sessions/:id/status              - Get session status
GET    /api/sessions/:id/audit               - Get audit log
```

### Notifications

```
GET    /api/sessions/user/notifications         - Get all notifications
GET    /api/sessions/user/action-required       - Get action-required notifications
GET    /api/sessions/user/unread-count          - Get unread count
POST   /api/sessions/notification/:id/read      - Mark as read
POST   /api/sessions/user/mark-all-read         - Mark all as read
DELETE /api/sessions/notification/:id           - Delete notification
```

---

## 🗂️ File Structure

```
backend/
├── services/
│   ├── sessionService.js          # Core session logic
│   ├── notificationService.js     # Notification management
│   └── socketService.js           # Real-time updates
├── routes/
│   ├── sessions.js                # API endpoints
│   └── ... (existing routes)
└── index.js                       # Updated with Socket.io

frontend/
├── components/
│   ├── CancelSessionModal.js      # Cancel confirmation
│   ├── CancelSessionModal.css
│   ├── ReassignmentNotificationCard.js
│   ├── ReassignmentNotificationCard.css
│   ├── StudentConfirmationModal.js
│   ├── StudentConfirmationModal.css
│   ├── NotificationCenter.js      # Notification dashboard
│   └── NotificationCenter.css
├── context/
│   ├── useSocket.js               # Socket.io hook
│   └── AuthContext.js             # Updated with socket
└── ... (existing components)

database/
└── schema_sessions_migration.sql  # Schema updates
```

---

## 📊 Database Schema Changes

### New Fields in `appointments`

| Field | Type | Purpose |
|-------|------|---------|
| `status` | TEXT | Session state (scheduled, cancelled_by_counsellor, pending_counsellor_acceptance, etc.) |
| `replacement_candidates` | UUID[] | List of candidate counsellor IDs |
| `accepted_by` | UUID | Counsellor who accepted the reassignment |
| `current_candidate_index` | INT | Current position in candidates list |
| `cancellation_reason` | TEXT | Why session was cancelled |
| `cancelled_at` | TIMESTAMP | When session was cancelled |
| `student_confirmed_at` | TIMESTAMP | When student confirmed |
| `version` | INT | For optimistic locking (race condition prevention) |

### New Tables

- `notifications` - Stores all notifications with read status
- `session_audit_log` - Tracks all session changes

---

## 🚀 Deployment Checklist

- [ ] Database migration applied
- [ ] Backend Socket.io initialized
- [ ] Environment variables configured
- [ ] Routes mounted in main server
- [ ] Frontend Socket.io hook created
- [ ] Components imported in pages
- [ ] Email/SMS notifications configured (optional)
- [ ] Testing completed for all scenarios
- [ ] Error handling verified
- [ ] Performance tested with load
- [ ] CORS settings configured for production URLs

---

## 🐛 Troubleshooting

### Socket.io not connecting

```
Error: CORS policy blocked
Solution: Update CORS origins in socketService.js with your domain
```

### Race condition still occurring

```
Check: Ensure version field is being incremented in all UPDATE queries
Check: Verify status is being validated before each state change
```

### Notifications not sending

```
Check: Verify user is in correct room (user:${userId})
Check: Check browser console for Socket.io connection status
Check: Verify backend is emitting to correct room
```

### Optimistic lock failures

```
Error: "Session updated by another user"
This is expected behavior! Show user a retry button or refresh data
```

---

## 📝 Notes

- Notifications expire after specified time (e.g., 2 minutes for reassignment)
- Expired notifications are cleaned up by periodic task
- All changes are logged in `session_audit_log` for compliance
- Socket.io falls back to polling if WebSocket unavailable
- System supports up to N concurrent requests (no hard limit in design)

---

## 🔗 Related Documentation

- [Supabase Real-time](https://supabase.com/docs/guides/realtime)
- [Socket.io Documentation](https://socket.io/docs/)
- [Optimistic Locking Pattern](https://en.wikipedia.org/wiki/Optimistic_concurrency_control)
