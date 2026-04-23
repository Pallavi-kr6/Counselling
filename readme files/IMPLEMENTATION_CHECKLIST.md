# Day Order Implementation Checklist

## Pre-Implementation
- [ ] Read `IMPLEMENTATION_SUMMARY.md` to understand changes
- [ ] Read `DAY_ORDER_QUICK_START.md` for step-by-step guide
- [ ] Read `VISUAL_GUIDE.md` to understand the architecture
- [ ] Review `DAY_ORDER_MIGRATION_GUIDE.md` for detailed reference
- [ ] Backup your database (CRITICAL!)
  ```bash
  # Supabase backup command
  supabase db pull > backup.sql
  ```

## Database Migration

### Phase 1: Create New Tables & Columns
- [ ] Create `day_orders` table
  ```sql
  -- Run script from SQL_MIGRATION_SCRIPTS.md - Step 1
  ```
- [ ] Add `day_order_id` column to `counsellor_availability`
  ```sql
  -- Run script from SQL_MIGRATION_SCRIPTS.md - Step 2
  ```
- [ ] Add `day_order_id` column to `appointments`
  ```sql
  -- Run script from SQL_MIGRATION_SCRIPTS.md - Step 3
  ```
- [ ] Create new indexes
  ```sql
  -- Run script from SQL_MIGRATION_SCRIPTS.md - Step 4
  ```

### Phase 2: Verify Database Changes
- [ ] Check `day_orders` table exists with 4 records
  ```sql
  SELECT * FROM day_orders;
  -- Should return 4 rows
  ```
- [ ] Check `counsellor_availability` has `day_order_id` column
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'counsellor_availability' AND column_name = 'day_order_id';
  ```
- [ ] Check `appointments` has `day_order_id` column
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'appointments' AND column_name = 'day_order_id';
  ```
- [ ] Verify indexes are created
  ```sql
  SELECT * FROM pg_indexes 
  WHERE schemaname = 'public' AND tablename IN ('counsellor_availability', 'appointments', 'day_orders');
  ```

### Phase 3: Set Up Counselor Availability
- [ ] Get list of all counselors
  ```sql
  SELECT id, user_id, name FROM counsellor_profiles;
  ```
- [ ] For each counselor, determine which day orders they work
- [ ] Insert availability records
  ```sql
  -- Example:
  INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
  VALUES 
    ('counsellor-1-id', (SELECT id FROM day_orders WHERE order_number = 1), '10:00', '18:00', true),
    ('counsellor-1-id', (SELECT id FROM day_orders WHERE order_number = 2), '14:00', '20:00', true)
  ON CONFLICT DO NOTHING;
  ```
- [ ] Verify all counselors have at least one day order assignment
  ```sql
  SELECT cp.name, do.order_name
  FROM counsellor_profiles cp
  JOIN counsellor_availability ca ON cp.user_id = ca.counsellor_id
  JOIN day_orders do ON ca.day_order_id = do.id
  ORDER BY cp.name, do.order_number;
  ```

### Phase 4: Migrate Existing Data (Optional)
- [ ] If you have existing appointments without `day_order_id`:
  ```sql
  UPDATE appointments 
  SET day_order_id = (SELECT id FROM day_orders WHERE order_number = 1)
  WHERE day_order_id IS NULL;
  ```
- [ ] Verify all appointments have day_order_id (or understand why they don't)
  ```sql
  SELECT COUNT(*) FROM appointments WHERE day_order_id IS NULL;
  ```

## Backend Code Changes

### Phase 1: Verify Backend Files
- [ ] Check `server/routes/appointments.js` contains new endpoints:
  - [ ] `GET /appointments/day-orders`
  - [ ] `GET /appointments/day-order/:dayOrderId/available-counsellors`
  - [ ] `POST /appointments/book-day-order`
- [ ] Verify helper functions exist:
  - [ ] `generateTimeSlots()` function exists
  - [ ] `sendAppointmentEmail()` function exists

### Phase 2: Test Backend APIs
- [ ] Start backend server
  ```bash
  cd server
  npm start
  ```
- [ ] Test `/appointments/day-orders` endpoint
  ```bash
  curl -X GET http://localhost:5000/api/appointments/day-orders \
    -H "Authorization: Bearer YOUR_TOKEN"
  # Expected: Returns array of 4 day orders
  ```
- [ ] Test `/appointments/day-order/:id/available-counsellors` endpoint
  ```bash
  curl -X GET "http://localhost:5000/api/appointments/day-order/DAY-ORDER-UUID/available-counsellors?date=2024-02-20" \
    -H "Authorization: Bearer YOUR_TOKEN"
  # Expected: Returns array of counselors with available slots
  ```
- [ ] Test `/appointments/book-day-order` endpoint
  ```bash
  curl -X POST http://localhost:5000/api/appointments/book-day-order \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{
      "dayOrderId": "UUID",
      "counsellorId": "UUID",
      "date": "2024-02-20",
      "startTime": "10:00",
      "endTime": "10:30",
      "notes": "Test booking"
    }'
  # Expected: Returns 201 with appointment details
  ```
- [ ] Check for errors in server console
- [ ] Verify email was sent (if emails are configured)

## Frontend Code Changes

### Phase 1: Verify Frontend Files
- [ ] `client/src/pages/BookAppointmentDayOrder.js` exists
- [ ] `client/src/pages/BookAppointment.css` has updated styles
- [ ] `client/src/App.js` imports `BookAppointmentDayOrder` instead of `BookAppointment`
- [ ] Route `/book-appointment` uses `BookAppointmentDayOrder`

### Phase 2: Test Frontend
- [ ] Start frontend development server
  ```bash
  cd client
  npm run dev
  ```
- [ ] Open browser and navigate to `/book-appointment`
- [ ] Verify page loads without errors
- [ ] Check browser console for JavaScript errors (F12)
- [ ] Clear browser cache if needed (Ctrl+Shift+Delete)

### Phase 3: Test Booking Flow
- [ ] Step 1: Day Order dropdown appears with 4 options
  - [ ] Can select each day order
  - [ ] Default selection (Day Order 1) appears
- [ ] Step 2: Date input field appears
  - [ ] Today's date is disabled (can't select past dates)
  - [ ] Can select dates up to 30 days ahead
  - [ ] Selected date shows in readable format below input
- [ ] Step 3: Counselors load after date selection
  - [ ] Shows counselor name, designation, department
  - [ ] Shows room number and phone number
  - [ ] Shows available hours
  - [ ] Shows number of available slots
  - [ ] Shows "Available" or "Fully Booked" badge
  - [ ] Can click on available counselor
  - [ ] Fully booked counselors are disabled (grayed out)
- [ ] Step 4: Time slots appear after counselor selection
  - [ ] Shows all available 30-minute slots
  - [ ] Can select a time slot
  - [ ] Selected slot highlights
- [ ] Step 5: Notes field appears (optional)
  - [ ] Can type in textarea
- [ ] Booking Summary appears
  - [ ] Shows selected day order, counselor, date, time, location
- [ ] Confirm Booking button
  - [ ] Button is enabled when all required fields selected
  - [ ] Button shows "Booking..." while processing
  - [ ] Success message appears after booking
  - [ ] Redirects to `/appointments` after 2 seconds

### Phase 4: Test Error Scenarios
- [ ] Try to book without selecting counselor → Shows error
- [ ] Try to book without selecting time slot → Shows error
- [ ] Select a fully booked counselor → Shows "Fully Booked" message
- [ ] Try to book in the past → Date input rejects it
- [ ] Refresh page after selecting day order → Retains selection
- [ ] Check mobile responsiveness (resize browser)

## Integration Testing

### Phase 1: End-to-End Flow
- [ ] Log in as a student
- [ ] Navigate to "Book an Appointment"
- [ ] Complete full booking flow (all 5 steps)
- [ ] Verify appointment appears in "My Appointments"
- [ ] Check email for confirmation
- [ ] Log in as counselor
- [ ] Verify counselor sees the new appointment

### Phase 2: Availability Testing
- [ ] Book an appointment for 10:00-10:30
- [ ] Try booking the same counselor for 10:00-10:30 again
  - [ ] Should not be possible (slot unavailable)
- [ ] Try booking 10:30-11:00
  - [ ] Should succeed (different slot)
- [ ] Verify booking appears for both counselor and student

### Phase 3: Multiple Counselors
- [ ] Set up multiple counselors with different availability
- [ ] For each day order, should see correct counselors
- [ ] Different counselors should have different hours
- [ ] Bookings should prevent double-booking

### Phase 4: Email Testing
- [ ] Book appointment and verify email received
- [ ] Check email contains:
  - [ ] Counselor name
  - [ ] Appointment date and time
  - [ ] Location/room number
  - [ ] Zoom meeting link (if enabled)
- [ ] Email formatting looks correct

## Deployment Preparation

### Pre-Deployment Checklist
- [ ] All database migrations completed successfully
- [ ] Backend API tests passed
- [ ] Frontend integration tests passed
- [ ] Error handling tested
- [ ] Email notifications working
- [ ] Zoom integration working (if enabled)
- [ ] No console errors in browser
- [ ] No errors in server logs
- [ ] All navigation links work
- [ ] Mobile responsive design verified

### Production Deployment Steps
- [ ] Deploy database migrations to production
- [ ] Deploy backend code to production server
- [ ] Deploy frontend code to production server
- [ ] Clear production cache (if applicable)
- [ ] Run final sanity checks in production
- [ ] Monitor error logs for issues
- [ ] Prepare support materials for users

## Post-Deployment

### Phase 1: Monitoring (First 24 hours)
- [ ] Check error logs for any issues
- [ ] Monitor email sending (verify emails go out)
- [ ] Check API response times (should be fast)
- [ ] Gather any user feedback
- [ ] Be ready to roll back if critical issues

### Phase 2: User Communication
- [ ] Notify students/counselors of new booking system
- [ ] Provide documentation on how to use day orders
- [ ] Answer user questions
- [ ] Gather feedback for improvements

### Phase 3: Cleanup (After 1 week)
- [ ] Remove old `BookAppointment.js` if not needed
- [ ] Remove old calendar CSS (if not used elsewhere)
- [ ] Archive migration documentation
- [ ] Update user manuals/documentation

## Optional: Data Cleanup

Once system is stable (after 1-2 weeks):
- [ ] Remove `day_of_week` column from `counsellor_availability`
  ```sql
  ALTER TABLE counsellor_availability DROP COLUMN day_of_week;
  ```
- [ ] Run database optimization
  ```sql
  VACUUM ANALYZE;
  ```

## Rollback Plan (if needed)

If critical issues arise:
- [ ] Stop accepting new bookings (disable button)
- [ ] Restore from backup
  ```bash
  supabase db reset < backup.sql
  ```
- [ ] Revert frontend to old BookAppointment component
- [ ] Test thoroughly before re-deploying
- [ ] Document what went wrong
- [ ] Plan fixes

## Documentation

- [ ] Share `IMPLEMENTATION_SUMMARY.md` with team
- [ ] Share `DAY_ORDER_QUICK_START.md` with admin/setup team
- [ ] Share `VISUAL_GUIDE.md` with product team
- [ ] Update internal wiki/documentation
- [ ] Create user guide for students (if needed)
- [ ] Create counselor setup guide (if needed)

## Success Criteria

✅ System is considered successful when:
- [ ] Students can book appointments using day order system
- [ ] Counselors see accurate availability
- [ ] No double-booking occurs
- [ ] Emails are sent correctly
- [ ] Zoom meetings are created (if enabled)
- [ ] No critical errors in logs
- [ ] Performance is acceptable
- [ ] Users report satisfaction
- [ ] Zero data loss occurs

## Support & Escalation

### Known Limitations
- [ ] Maximum 30-day booking window
- [ ] 30-minute time slots (not configurable in UI)
- [ ] Only 4 day orders (can be extended with code change)

### Common Issues & Fixes
- [ ] No counselors showing → Check `counsellor_availability` table
- [ ] Wrong email → Check email configuration in `.env`
- [ ] Zoom not working → Check Zoom API credentials
- [ ] Slow performance → Check database indexes

## Final Sign-Off

- [ ] All tests passed ✓
- [ ] No critical issues ✓
- [ ] Documentation complete ✓
- [ ] Team trained ✓
- [ ] Ready for production deployment ✓

---

**Date Started:** _______________
**Date Completed:** _______________
**Completed By:** _______________
**Notes:** 

