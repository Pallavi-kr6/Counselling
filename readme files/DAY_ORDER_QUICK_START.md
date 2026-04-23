# Day Order Booking System - Quick Start Guide

## What Was Changed?

Your counseling appointment booking system has been migrated from a **calendar-based system** to a **day order-based system**. 

**Old Flow:** Student selects Counselor → Selects Date (calendar) → Selects Time Slot

**New Flow:** Student selects Day Order → Selects Date → Selects Counselor → Selects Time Slot

## Files Modified/Created

### Backend
- ✅ **`server/routes/appointments.js`** - Added new endpoints for day order system:
  - `GET /appointments/day-orders` - Fetch all active day orders
  - `GET /appointments/day-order/:dayOrderId/available-counsellors` - Fetch available counsellors for a day order
  - `POST /appointments/book-day-order` - Book appointment using day order system

### Frontend
- ✅ **`client/src/pages/BookAppointmentDayOrder.js`** - New component implementing day order UI
- ✅ **`client/src/pages/BookAppointment.css`** - Updated and enhanced styling
- ✅ **`client/src/App.js`** - Updated routing to use new component

### Database
- ✅ **`supabase/schema.sql`** - Updated schema with:
  - New `day_orders` table
  - Modified `counsellor_availability` table
  - Updated `appointments` table

## Implementation Steps

### Step 1: Update Your Database

Execute the SQL migrations in this order:

```bash
# Option A: If using Supabase console
# 1. Go to Supabase Dashboard → Click your project
# 2. Navigate to SQL Editor
# 3. Copy-paste each script from SQL_MIGRATION_SCRIPTS.md
# 4. Execute each script in order

# Option B: If using Supabase CLI
# supabase db push
```

**Required Scripts (in order):**
1. Create day_orders table + insert default values
2. Add day_order_id column to counsellor_availability
3. Add day_order_id column to appointments
4. Create new indexes

See `SQL_MIGRATION_SCRIPTS.md` for complete scripts.

### Step 2: Set Up Counsellor Availability

You need to update how counsellors define their availability. Instead of per-day-of-week, they now set per-day-order.

**Example Setup:**
```sql
-- Get available counsellors and day orders
SELECT cp.user_id, cp.name FROM counsellor_profiles cp;
SELECT id, order_name FROM day_orders;

-- Add availability for each counsellor for each day order they work
INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
VALUES 
  ('counsellor-1-uuid', (SELECT id FROM day_orders WHERE order_number = 1), '10:00', '18:00', true),
  ('counsellor-1-uuid', (SELECT id FROM day_orders WHERE order_number = 2), '14:00', '20:00', true),
  ('counsellor-2-uuid', (SELECT id FROM day_orders WHERE order_number = 1), '09:00', '17:00', true)
ON CONFLICT DO NOTHING;
```

### Step 3: Test the Backend APIs

Once database is set up, test the APIs:

```bash
# 1. Get day orders (requires authentication token)
curl -X GET http://localhost:5000/api/appointments/day-orders \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response:
# {
#   "dayOrders": [
#     {"id": "uuid", "order_name": "Day Order 1", "order_number": 1, ...},
#     {"id": "uuid", "order_name": "Day Order 2", "order_number": 2, ...},
#     ...
#   ]
# }

# 2. Get available counsellors for a day order
curl -X GET "http://localhost:5000/api/appointments/day-order/DAY-ORDER-UUID/available-counsellors?date=2024-02-20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Book an appointment
curl -X POST http://localhost:5000/api/appointments/book-day-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "dayOrderId": "uuid",
    "counsellorId": "uuid",
    "date": "2024-02-20",
    "startTime": "10:00",
    "endTime": "10:30",
    "notes": "Initial consultation"
  }'
```

### Step 4: Restart Your Application

```bash
# Kill existing processes
# Restart client
cd client
npm run dev

# Restart server (new terminal)
cd server
npm start
```

### Step 5: Test the Frontend

1. **As a Student:**
   - Navigate to "Book an Appointment"
   - You should see a dropdown with day orders (Day Order 1, 2, 3, 4)
   - Select a day order
   - Select a date (from today to 30 days ahead)
   - Available counsellors should appear
   - Select a counsellor → time slot → confirm booking

2. **Expected Behavior:**
   - If no counsellors available: "No counsellors available for the selected day order and date"
   - If counsellor fully booked: Shows "Fully Booked" badge
   - If counsellor available: Shows available time slots
   - After booking: Confirmation message and email sent

### Step 6: Migrate Existing Appointments (Optional)

If you have existing appointments and want to populate day_order_id:

```sql
-- Assign existing appointments to Day Order 1 (temporary)
UPDATE appointments 
SET day_order_id = (SELECT id FROM day_orders WHERE order_number = 1)
WHERE day_order_id IS NULL;

-- Or create a mapping based on your business logic
-- See SQL_MIGRATION_SCRIPTS.md for advanced options
```

## Testing Checklist

- [ ] Day orders appear in dropdown
- [ ] Date picker works correctly (blocks past dates)
- [ ] Selecting day order fetches counsellors
- [ ] Available counsellors show with hours and slots
- [ ] Fully booked counsellors are disabled/grayed out
- [ ] Time slots display correctly
- [ ] Booking creates appointment successfully
- [ ] Confirmation email received
- [ ] Appointment appears in "My Appointments" list
- [ ] Counsellors can see the appointment

## Common Issues & Solutions

### Issue: "No day orders found"
**Solution:** Run the day_orders insert script in SQL_MIGRATION_SCRIPTS.md

### Issue: "No counsellors available"
**Solution:** Check that counsellor_availability records exist with matching day_order_id

**Verify:**
```sql
SELECT ca.*, do.order_name 
FROM counsellor_availability ca
JOIN day_orders do ON ca.day_order_id = do.id
WHERE ca.is_available = true;
```

### Issue: Frontend doesn't load the new component
**Solution:** 
- Clear browser cache (Ctrl+Shift+Delete)
- Restart the development server
- Check browser console for errors (F12)

### Issue: "Failed to fetch available counsellors"
**Solution:**
- Check server logs for errors
- Verify API endpoint is returning data
- Ensure authentication token is valid

## API Reference

### GET /appointments/day-orders
Fetches all active day orders
- **No parameters required**
- **Response:** Array of day order objects

### GET /appointments/day-order/:dayOrderId/available-counsellors?date=YYYY-MM-DD
Fetches available counsellors for a specific day order on a given date
- **Parameters:**
  - `dayOrderId` (path) - UUID of day order
  - `date` (query) - Date in YYYY-MM-DD format
- **Response:** Array of counsellor objects with available slots

### POST /appointments/book-day-order
Books an appointment using the day order system
- **Body:**
  ```json
  {
    "dayOrderId": "uuid",
    "counsellorId": "uuid",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "notes": "optional notes"
  }
  ```
- **Response:** Appointment details with zoom meeting link

## Feature Highlights

✅ **Dropdown-based Day Order Selection** - Simple and intuitive
✅ **Dynamic Counsellor Loading** - Shows only available counsellors
✅ **Real-time Availability** - Updates based on existing bookings
✅ **Email Confirmation** - Student receives appointment details
✅ **Zoom Integration** - Automatic meeting creation
✅ **Responsive Design** - Works on desktop and mobile
✅ **Clear UI Feedback** - Shows unavailable counsellors with message

## Configuration

### To add more day orders:
```sql
INSERT INTO day_orders (order_name, order_number, description, is_active)
VALUES ('Day Order 5', 5, 'Fifth rotation day', true);
```

### To disable a day order:
```sql
UPDATE day_orders SET is_active = false WHERE order_number = 4;
-- Students won't see this in the dropdown
```

### To change time slot duration (currently 30 minutes):
Edit `server/routes/appointments.js`, find `slotDuration = 30` and change the value.

## Performance Considerations

- Day order queries are indexed for fast lookups
- Counsellor availability is cached in the component
- Auto-refreshes data when date or day order changes
- Zoom meeting creation is non-blocking

## Support & Troubleshooting

See `DAY_ORDER_MIGRATION_GUIDE.md` for:
- Detailed architecture explanation
- Complete API reference
- Database schema details
- Advanced migration scenarios
- Rollback instructions

## Next Steps

1. Complete all implementation steps above
2. Test thoroughly in development
3. Test with real counsellor schedules
4. Deploy to production
5. Monitor email confirmations
6. Gather user feedback

## Need Help?

- Check the detailed migration guide: `DAY_ORDER_MIGRATION_GUIDE.md`
- Review SQL scripts: `SQL_MIGRATION_SCRIPTS.md`
- Check server logs: `npm start` in server directory
- Check browser console: F12 in browser
- Verify database: Supabase console → "Browse data" → check tables

Happy booking! 🎯
