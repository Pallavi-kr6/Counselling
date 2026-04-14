# Day Order-Based Booking System - Migration Guide

## Overview
This guide explains the changes made to migrate from a calendar-based appointment booking system to a day order-based system. This new approach allows counselors to define availability by "day orders" (rotating schedules) rather than specific day-of-weeks.

## Key Changes

### 1. Database Schema Changes

#### New Tables

**`day_orders` Table:**
```sql
CREATE TABLE IF NOT EXISTS day_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_name TEXT NOT NULL UNIQUE, -- e.g., "Day Order 1", "Day Order 2"
  order_number INTEGER NOT NULL UNIQUE, -- 1, 2, 3, 4
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Predefined day orders are automatically inserted:**
- Day Order 1
- Day Order 2
- Day Order 3
- Day Order 4

#### Modified Tables

**`counsellor_availability` Table:**
- **Removed:** `day_of_week` column (no longer used)
- **Added:** `day_order_id` column (foreign key to day_orders table)

**Before:**
```sql
CREATE TABLE counsellor_availability (
  ...
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  ...
);
```

**After:**
```sql
CREATE TABLE counsellor_availability (
  ...
  day_order_id UUID REFERENCES day_orders(id) ON DELETE CASCADE,
  ...
);
```

**`appointments` Table:**
- **Added:** `day_order_id` column (to track which day order the appointment is for)

**Before:**
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY...,
  student_id UUID...,
  counsellor_id UUID...,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  ...
);
```

**After:**
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY...,
  student_id UUID...,
  counsellor_id UUID...,
  day_order_id UUID REFERENCES day_orders(id)...,  -- NEW
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  ...
);
```

#### New Indexes
- `idx_counsellor_availability_day_order` on `counsellor_availability(day_order_id)`
- `idx_day_orders_active` on `day_orders(is_active)`
- `idx_appointments_day_order` on `appointments(day_order_id)`

### 2. Backend API Changes

#### New Endpoints

**1. Get All Day Orders**
```
GET /appointments/day-orders
```
**Response:**
```json
{
  "dayOrders": [
    {
      "id": "uuid",
      "order_name": "Day Order 1",
      "order_number": 1,
      "description": "First rotation day",
      "is_active": true,
      "created_at": "timestamp"
    },
    ...
  ]
}
```

**2. Get Available Counsellors for a Day Order**
```
GET /appointments/day-order/:dayOrderId/available-counsellors?date=YYYY-MM-DD
```
**Response:**
```json
{
  "counsellors": [
    {
      "availability_id": "uuid",
      "counsellor_id": "uuid",
      "counsellor_name": "Dr. John Doe",
      "designation": "Senior Counsellor",
      "department": "Student Welfare",
      "room_no": "101",
      "phone_no": "9876543210",
      "start_time": "10:00",
      "end_time": "18:00",
      "is_available": true,
      "available_slots": [
        {
          "start_time": "10:00",
          "end_time": "10:30",
          "available": true
        },
        ...
      ],
      "booked_count": 3
    },
    ...
  ],
  "date": "2024-02-20",
  "dayOrderId": "uuid"
}
```

**3. Book Appointment (Day Order System)**
```
POST /appointments/book-day-order
```
**Request Body:**
```json
{
  "dayOrderId": "uuid",
  "counsellorId": "uuid",
  "date": "2024-02-20",
  "startTime": "10:00",
  "endTime": "10:30",
  "notes": "Optional notes about the session"
}
```

**Response:**
```json
{
  "success": true,
  "appointment": {
    "id": "uuid",
    "student_id": "uuid",
    "counsellor_id": "uuid",
    "day_order_id": "uuid",
    "date": "2024-02-20",
    "start_time": "10:00",
    "end_time": "10:30",
    "status": "scheduled",
    "counsellorName": "Dr. John Doe",
    "dayOrder": "Day Order 1",
    "zoomMeeting": {...}
  },
  "message": "Appointment booked successfully!"
}
```

#### Updated Endpoints
- **Old:** `/appointments/slots/:counsellorId?date=YYYY-MM-DD` (still available for backward compatibility)
- **New preferred:** `/appointments/day-order/:dayOrderId/available-counsellors?date=YYYY-MM-DD`

### 3. Frontend Changes

#### Replaced Component
- **Old:** `BookAppointment.js` (calendar-based)
- **New:** `BookAppointmentDayOrder.js` (day order-based)

#### New User Flow

**Step 1: Select Day Order**
- Dropdown menu showing all active day orders
- Auto-selects first day order on page load

**Step 2: Select Date**
- Date input field (min: today, max: 30 days ahead)
- Shows formatted date below the input

**Step 3: Select Counsellor**
- Dynamically loads counsellors available for the selected day order and date
- Shows:
  - Counsellor name, designation, department
  - Room number and phone number
  - Available hours (start_time - end_time)
  - Number of available slots
  - Availability badge (Available / Fully Booked)
- Disabled state for fully booked counsellors

**Step 4: Select Time Slot**
- Grid of available time slots
- Only shows after counsellor selection
- 30-minute slots (configurable in backend)

**Step 5: Additional Notes (Optional)**
- Textarea for any specific concerns or topics

**Booking Summary**
- Shows selected day order, counsellor, date, time, and location
- Only visible after selecting time slot

#### UI Enhancements
- Better error messages for unavailable dates/counsellors
- Loading states while fetching data
- Responsive grid layout for counsellor cards
- Visual indicators for availability status
- Improved form styling

### 4. Migration Instructions

#### For Database
1. **Backup your existing database**
   ```bash
   # Using Supabase local development
   supabase db pull
   ```

2. **Apply the schema changes**
   - Update the `supabase/schema.sql` file with the new schema
   - Or manually run the SQL commands in the Supabase console

3. **Migrate existing availability data** (if you have old counsellor_availability records)
   ```sql
   -- Map old day_of_week to day_orders
   -- You'll need to decide which day order each counsellor should be assigned
   
   UPDATE counsellor_availability ca
   SET day_order_id = (
     SELECT id FROM day_orders 
     WHERE order_number = (ca.day_of_week % 4) + 1
   )
   WHERE day_order_id IS NULL;
   ```
   *Note: Adjust the logic based on your specific mapping*

4. **Optional: Remove old day_of_week column after migration**
   ```sql
   ALTER TABLE counsellor_availability DROP COLUMN day_of_week;
   ```

#### For Backend
1. **No breaking changes** - Old endpoints still work
2. **Add new endpoints** - Already included in the updated `appointments.js`
3. **Update counsellor availability setup**
   - Instead of setting `day_of_week`, set `day_order_id`

#### For Frontend
1. **Update App.js routing**
   - Changed from `BookAppointment` to `BookAppointmentDayOrder`
   - Already done in the new App.js

2. **CSS updates**
   - Enhanced styling for new form elements
   - Added styles for dropdowns, date inputs, and loading states
   - Already included in the updated `BookAppointment.css`

### 5. Counsellor Availability Setup

#### Before (Calendar-based)
Counsellors set availability like:
```
Monday: 10:00 - 18:00
Tuesday: 10:00 - 18:00
Wednesday: OFF
Thursday: 10:00 - 18:00
Friday: 10:00 - 18:00
```

#### After (Day Order-based)
Counsellors set availability like:
```
Day Order 1: 10:00 - 18:00
Day Order 2: 14:00 - 20:00
Day Order 3: OFF
Day Order 4: 09:00 - 17:00
```

**Setup Example:**
```sql
-- Add availability for Counsellor X for Day Order 1
INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
VALUES (
  'counsellor-uuid',
  (SELECT id FROM day_orders WHERE order_number = 1),
  '10:00',
  '18:00',
  true
);
```

### 6. Time Slot Generation

The system generates 30-minute time slots based on counsellor's available hours:
- Example: 10:00-18:00 availability generates: 10:00-10:30, 10:30-11:00, ..., 17:30-18:00
- Accounts for already booked slots
- Adjustable slot duration in backend (currently 30 minutes)

### 7. Availability Checking Logic

For each counsellor in a day order:
1. Fetch counsellor's availability record for the day order
2. Check if `is_available` flag is true
3. Fetch all booked appointments for that counsellor on the selected date and day order
4. Generate available time slots excluding booked ones
5. If no slots available, mark as "Fully Booked"

### 8. Backward Compatibility

- Old `/appointments/slots/:counsellorId` endpoint still works
- Existing appointments maintain their data structure
- Old BookAppointment component still exists (can be used as backup)

### 9. Benefits of Day Order System

✅ **Rotating Schedules**: Supports counsellors with rotating duty schedules
✅ **Simplified Selection**: Students choose from predefined day orders
✅ **Better Availability Management**: Easier to manage complex scheduling
✅ **Scalable**: Easy to add more day orders if needed
✅ **Clear Communication**: Students understand the day order system better

### 10. Testing Checklist

- [ ] Create day orders in database
- [ ] Set up counsellor availability for day orders
- [ ] Test GET /appointments/day-orders endpoint
- [ ] Test GET /appointments/day-order/:id/available-counsellors endpoint
- [ ] Book an appointment with POST /appointments/book-day-order
- [ ] Verify appointment shows in Appointments list
- [ ] Confirm email sent to student
- [ ] Check that fully booked counsellors show as unavailable
- [ ] Test date range restrictions
- [ ] Verify zoom meeting creation (if enabled)

### 11. Troubleshooting

**Issue: No counsellors appear for a day order**
- Verify day_order_id matches in counsellor_availability table
- Check that is_available is set to true
- Ensure date is within counsellor's availability window

**Issue: Time slots not showing**
- Check counsellor availability start_time and end_time
- Verify no conflicting appointments exist
- Ensure slot duration logic is correct (30 minutes)

**Issue: Appointment booking fails**
- Verify all required fields are provided
- Check that counsellor availability exists for the day order
- Ensure no slot conflicts with existing appointments

## Summary

The day order-based booking system provides a more flexible approach to managing counsellor schedules, especially for institutions with rotating duty schedules. The migration is straightforward, and the system maintains backward compatibility while providing an improved user experience for students booking appointments.
