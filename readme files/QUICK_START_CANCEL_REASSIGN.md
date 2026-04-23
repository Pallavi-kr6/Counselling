# Cancel & Reassign Session - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Run Database Migration (2 minutes)

1. Go to Supabase dashboard → SQL Editor
2. Open file: `supabase/schema_sessions_migration.sql`
3. Copy all SQL and paste into Supabase editor
4. Click "Run"
5. ✅ Done!

### Step 2: Install Dependencies (1 minute)

```bash
# Backend
cd backend
npm install socket.io

# Frontend
cd frontend
npm install socket.io-client
```

### Step 3: Update Backend Entry Point (1 minute)

**File: `backend/index.js`**

Add at the top (after imports):
```javascript
const http = require('http');
const socketService = require('./services/socketService');
```

Change:
```javascript
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

To:
```javascript
const server = http.createServer(app);
const io = socketService.initializeSocket(server);
app.locals.io = io;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Step 4: Add Components to Your Pages (1 minute)

In your counsellor dashboard:
```javascript
import CancelSessionModal from '../components/CancelSessionModal';
import NotificationCenter from '../components/NotificationCenter';

// Add to JSX:
<button onClick={() => setShowCancelModal(true)}>
  Cancel Session
</button>

<CancelSessionModal
  isOpen={showCancelModal}
  session={session}
  onClose={() => setShowCancelModal(false)}
  onSuccess={onSessionCancelled}
/>

<NotificationCenter />
```

---

## 📁 Files Created

### Backend
- `backend/services/sessionService.js` - Core logic (600+ lines)
- `backend/services/socketService.js` - Real-time notifications
- `backend/routes/sessions.js` - API endpoints
- `supabase/schema_sessions_migration.sql` - Database schema

### Frontend Components
- `frontend/src/components/CancelSessionModal.js` - Cancel confirmation
- `frontend/src/components/ReassignmentNotificationCard.js` - Counsellor notification
- `frontend/src/components/StudentConfirmationModal.js` - Student confirmation
- `frontend/src/components/NotificationCenter.js` - Notification hub
- `frontend/src/context/useSocket.js` - Socket.io hook
- `frontend/src/utils/sessionAPI.js` - API client

### Examples & Docs
- `frontend/src/pages/CounsellorSessionDetail.EXAMPLE.js` - Full example
- `CANCEL_REASSIGN_IMPLEMENTATION.md` - Complete guide

---

## 🚀 Quick API Usage

### Counsellor Cancels Session
```javascript
import { cancelSession } from '../utils/sessionAPI';

const result = await cancelSession(sessionId, 'Emergency');
// Session cancelled, replacement candidates notified
```

### Counsellor Accepts Reassignment
```javascript
import { acceptReassignment } from '../utils/sessionAPI';

const result = await acceptReassignment(sessionId);
// Student will receive confirmation request
```

### Get Notifications
```javascript
import { getActionRequiredNotifications } from '../utils/sessionAPI';

const { data } = await getActionRequiredNotifications();
// Returns pending reassignment requests
```

### Student Confirms
```javascript
import { confirmSession } from '../utils/sessionAPI';

const result = await confirmSession(sessionId);
// Session confirmed, ready to proceed
```

---

## 🔄 Workflow Summary

```
COUNSELLOR CANCELS SESSION
         ↓
FIND REPLACEMENT COUNSELLOR (with no conflicts)
         ↓
NOTIFY COUNSELLOR #1 (2-min timer)
         ↓
         ├─→ [ACCEPT] → Notify Student
         │              ├─→ [CONFIRM] → Session ready ✅
         │              └─→ [REJECT] → Try next counsellor
         │
         └─→ [REJECT] → Notify Counsellor #2
                        └─→ [ACCEPT/REJECT] → ...
                
IF NO COUNSELLORS AVAILABLE
         ↓
Mark: needs_reschedule
Notify: Student
```

---

## 📊 Database Fields Added

All added to `appointments` table:

| Field | Type | Purpose |
|-------|------|---------|
| `status` | TEXT | Current session state |
| `replacement_candidates` | UUID[] | Array of candidate counsellors |
| `accepted_by` | UUID | Which counsellor accepted |
| `current_candidate_index` | INT | Position in candidates list |
| `version` | INT | For race condition prevention |
| `cancellation_reason` | TEXT | Why cancelled |
| `cancelled_at` | TIMESTAMP | When cancelled |

---

## 🛡️ Race Condition Safety

The system uses **optimistic locking** to prevent issues when multiple counsellors click "accept" simultaneously:

```
Before Update:  version = 1
WHERE check:    version = 1
After Update:   version = 2

If 2nd counsellor tries with version=1: UPDATE FAILS ✅
```

---

## 📱 Real-Time Updates (Socket.io)

Events emitted:
- `reassignment_request` - Counsellor gets notification
- `counsellor_accepted` - Student gets confirmation request
- `session_cancelled` - Student notified of cancellation
- `session_confirmed` - Counsellor notified of confirmation

Auto-connects using JWT token from AuthContext.

---

## ✅ Testing Checklist

- [ ] Database migration runs without errors
- [ ] npm dependencies installed
- [ ] Server starts with Socket.io
- [ ] Counsellor can cancel session
- [ ] Replacement counsellor gets notification
- [ ] Accepting redirects to student confirmation
- [ ] Student can confirm or reject
- [ ] Notifications disappear after 2 minutes (if not acted on)
- [ ] No errors in browser console
- [ ] No errors in server logs

---

## 🐛 Common Issues

### Issue: "Socket not connecting"
**Fix:** Check CORS origins in `socketService.js` match your frontend URL

### Issue: "Notifications not appearing"
**Fix:** Verify user joined room with: `socket.emit('join_user_room', userId)`

### Issue: "Race condition still happening"
**Fix:** Ensure `version` field is incremented in ALL UPDATE queries

### Issue: "Optimistic lock failing for valid updates"
**Fix:** Check previous transaction isn't leaving session in inconsistent state

---

## 🎓 Architecture Overview

```
FRONTEND
├─ CancelSessionModal (UI)
├─ ReassignmentNotificationCard (UI)
├─ StudentConfirmationModal (UI)
├─ NotificationCenter (Hub)
└─ useSocket Hook (Real-time)
         ↓
     API CALLS
         ↓
BACKEND ROUTES (/api/sessions/...)
         ↓
SESSION SERVICE (Core Logic)
├─ cancelSessionByCounsellor()
├─ acceptReassignment()
├─ rejectReassignment()
├─ confirmSessionByCounsellor()
└─ rejectSessionByCounsellor()
         ↓
DATABASE (PostgreSQL via Supabase)
├─ appointments (status, version, candidates)
├─ notifications (persistent queue)
├─ session_audit_log (compliance)
└─ find_available_counsellors() [SQL function]
         ↓
SOCKET.IO (Real-time notifications)
```

---

## 📞 Support

For detailed implementation help, see:
- `CANCEL_REASSIGN_IMPLEMENTATION.md` - Full step-by-step guide
- `CounsellorSessionDetail.EXAMPLE.js` - Integration example
- Code comments in each file

---

## 🎉 You're Ready!

Once all steps completed, your feature is live with:
- ✅ Session cancellation
- ✅ Auto reassignment to available counsellors
- ✅ Real-time notifications
- ✅ Race condition prevention
- ✅ Audit trail
- ✅ Student confirmation flow

**Time to implement: ~30 minutes**
**Time to test: ~20 minutes**
