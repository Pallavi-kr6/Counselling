# Task Implementation Plan: Session Completion & Daily Check-in Graph

## Information Gathered:

### Current Architecture:
1. **Database Schema (supabase/schema.sql)**:
   - `appointments` table has `status` field with values: 'scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed'
   - `mood_tracking` table stores daily mood entries with mood, stress_level, sleep_hours, etc.
   - `student_profiles` table stores student details

2. **Backend API (server/routes/appointments.js)**:
   - Already has `/appointments/complete/:id` endpoint (PUT) that marks appointments as completed
   - Has `/appointments/counsellor/student/:studentId` endpoint that returns student details including session counts and mood entries
   - Currently DOES NOT increment any "total session count" in student profiles - session count is derived from appointments

3. **Frontend Pages**:
   - `client/src/pages/CounsellorDashboard.js`: Shows upcoming appointments, no "complete session" button
   - `client/src/pages/StudentDashboard.js`: Shows student stats (total appointments count comes from appointments)
   - `client/src/pages/MoodTracking.js`: Has Daily Check-in Graph using Chart.js
   - `client/src/pages/CounsellorStudentDetail.js`: Shows student details with session counts and mood entries (list view, NO graph)

### Key Findings:
- Session counts are NOT stored in a separate field - they are calculated from the appointments table by counting completed sessions
- The "complete" endpoint already exists but needs validation to prevent duplicate completions
- MoodTracking.js already has the chart implementation that can be reused

---

## Implementation Plan

### Phase 1: Backend Enhancements

#### 1.1 Update `/appointments/complete/:id` endpoint (server/routes/appointments.js)
- Add check for already completed appointments (prevent duplicate increments)
- Return proper error message if already completed
- Add validation that only scheduled/confirmed appointments can be completed
- Return updated appointment data in response

---

### Phase 2: Counsellor Dashboard - Session Completion Button

#### 2.1 Update CounsellorDashboard.js
- Add state to track appointments with their completion status
- Add "Mark Session as Completed" button to each appointment card
- Handle button click:
  - Call API to complete session
  - Handle success/error responses
  - Show appropriate UI feedback (disable button when completed or show "Completed" status)
- Add UI styling for the button
- Ensure real-time update of appointment list after completion

---

### Phase 3: Student Dashboard - Real-Time Sync

#### 3.1 Update StudentDashboard.js
- Add polling mechanism to refresh session counts
- OR ensure parent component refreshes data after session completion
- Display updated total sessions count (from completed appointments)

---

### Phase 4: Counsellor Profile - Daily Check-in Graph

#### 4.1 Create/Update CounsellorStudentDetail.js
- Import Chart.js components (Line chart)
- Add state for mood data and selected student
- Fetch mood data for the student (already available via `/appointments/counsellor/student/:studentId`)
- Render the Daily Check-in Graph:
  - X-axis: Date
  - Y-axis: Mood (1-10) and Stress Level (1-10)
  - Use same chart configuration as MoodTracking.js
- Add student selector dropdown to view different students' graphs
- Make the graph dynamic based on selected student

---

## Files to Modify:

1. **server/routes/appointments.js** - Add validation and error handling for session completion
2. **client/src/pages/CounsellorDashboard.js** - Add completion button
3. **client/src/pages/StudentDashboard.js** - Ensure real-time sync
4. **client/src/pages/CounsellorStudentDetail.js** - Add Daily Check-in Graph

---

## Testing Checklist:

- [ ] Clicking "Mark Session as Completed" updates the appointment status in DB
- [ ] Clicking button again shows error (already completed)
- [ ] Button disables or changes to "Completed" after click
- [ ] Student Dashboard shows updated session count
- [ ] Counsellor Dashboard shows updated appointment status
- [ ] Daily Check-in Graph renders correctly on Counsellor Student Detail page
- [ ] Graph updates when switching between students
