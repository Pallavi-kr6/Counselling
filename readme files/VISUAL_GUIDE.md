# Day Order System - Visual Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    COUNSELING PORTAL                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Student Books Appointment                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Frontend: BookAppointmentDayOrder.js                      │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ Step 1: Select Day Order                           │  │ │
│  │  │ [Dropdown: Day Order 1 ▼]                          │  │ │
│  │  │                                                      │  │ │
│  │  │ Step 2: Select Date                                │  │ │
│  │  │ [Date Input: 2024-02-20]                           │  │ │
│  │  │                                                      │  │ │
│  │  │ Step 3: Select Counselor                           │  │ │
│  │  │ [Card: Dr. John - Available]                       │  │ │
│  │  │ [Card: Dr. Sarah - Fully Booked]                   │  │ │
│  │  │                                                      │  │ │
│  │  │ Step 4: Select Time Slot                           │  │ │
│  │  │ [10:00-10:30] [10:30-11:00] [11:00-11:30]         │  │ │
│  │  │                                                      │  │ │
│  │  │ Step 5: Notes (Optional)                           │  │ │
│  │  │ [Textarea: Any concerns...]                        │  │ │
│  │  │                                                      │  │ │
│  │  │ [CONFIRM BOOKING BUTTON]                           │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                API Calls    │
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────┐          ┌──────────┐        ┌─────────┐
   │GET       │          │GET       │        │POST     │
   │Day Orders│          │Available │        │Book     │
   │          │          │Counselors│        │         │
   └─────────┘          └──────────┘        └─────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                Backend      │
                             ▼
         ┌───────────────────────────────────┐
         │  appointments.js Routes           │
         │  ├─ GET /day-orders              │
         │  ├─ GET /day-order/:id/...      │
         │  └─ POST /book-day-order         │
         └───────────────────────────────────┘
                             │
                             ▼
         ┌───────────────────────────────────┐
         │      Supabase Database            │
         │  ├─ day_orders                    │
         │  ├─ counsellor_availability       │
         │  ├─ appointments                  │
         │  └─ zoom_meetings (optional)      │
         └───────────────────────────────────┘
```

## Database Relationship Diagram

```
┌──────────────────────┐
│   day_orders         │
├──────────────────────┤
│ id (UUID)            │◄─────────────────┐
│ order_name           │                  │
│ order_number         │                  │
│ description          │                  │
│ is_active            │                  │
│ created_at           │                  │
└──────────────────────┘                  │
         ▲                                │
         │                                │
         │ 1:N relationship               │ 1:N relationship
         │                                │
         │                                │
┌────────┴──────────┐         ┌───────────┴──────────┐
│counsellor_        │         │  appointments        │
│availability       │         ├──────────────────────┤
├───────────────────┤         │ id (UUID)            │
│ id (UUID)         │         │ student_id (UUID)   │
│ counsellor_id     │         │ counsellor_id       │
│ day_order_id ◄────┤─────────│ day_order_id ◄──────┤
│ start_time        │         │ date                 │
│ end_time          │         │ start_time           │
│ is_available      │         │ end_time             │
│ created_at        │         │ status               │
└───────────────────┘         │ notes                │
                              │ created_at           │
                              └──────────────────────┘
```

## Day Order Rotation System

```
┌─────────────────────────────────────────────┐
│        Week 1: Day Order 1                  │
│  ┌─────┬─────┬─────┬─────┬─────┐          │
│  │ Mon │ Tue │ Wed │ Thu │ Fri │          │
│  │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │          │
│  └─────┴─────┴─────┴─────┴─────┘          │
│  Available Counselors: Dr. A, Dr. B        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│        Week 2: Day Order 2                  │
│  ┌─────┬─────┬─────┬─────┬─────┐          │
│  │ Mon │ Tue │ Wed │ Thu │ Fri │          │
│  │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │          │
│  └─────┴─────┴─────┴─────┴─────┘          │
│  Available Counselors: Dr. C, Dr. D        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│        Week 3: Day Order 3                  │
│  ┌─────┬─────┬─────┬─────┬─────┐          │
│  │ Mon │ Tue │ Wed │ Thu │ Fri │          │
│  │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │          │
│  └─────┴─────┴─────┴─────┴─────┘          │
│  Available Counselors: Dr. E, Dr. F        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│        Week 4: Day Order 4                  │
│  ┌─────┬─────┬─────┬─────┬─────┐          │
│  │ Mon │ Tue │ Wed │ Thu │ Fri │          │
│  │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │          │
│  └─────┴─────┴─────┴─────┴─────┘          │
│  Available Counselors: Dr. G, Dr. H        │
└─────────────────────────────────────────────┘

Then it repeats...
```

## Booking Flow - Sequence Diagram

```
   Student                    Frontend              Backend              Database
      │                          │                      │                    │
      │ 1. Open Book Page        │                      │                    │
      ├──────────────────────────>│                      │                    │
      │                          │ 2. GET /day-orders   │                    │
      │                          ├─────────────────────>│                    │
      │                          │                      │ 3. Query day_orders│
      │                          │                      ├───────────────────>│
      │                          │                      │<─── Day Orders ────┤
      │        Day Orders        │<──────────────────────┤                    │
      │<──────────────────────────┤                      │                    │
      │                          │                      │                    │
      │ 4. Select Day Order      │                      │                    │
      │      & Date              │                      │                    │
      ├──────────────────────────>│                      │                    │
      │                          │ 5. GET /day-order/:id/available-counsellors
      │                          ├─────────────────────>│                    │
      │                          │                      │ 6. Query availability
      │                          │                      │    & appointments  │
      │                          │                      ├───────────────────>│
      │                          │                      │<─ Counselors data ─┤
      │    Counselors List       │<──────────────────────┤                    │
      │<──────────────────────────┤                      │                    │
      │                          │                      │                    │
      │ 7. Select Counselor      │                      │                    │
      │    & Time Slot           │                      │                    │
      ├──────────────────────────>│                      │                    │
      │                          │ 8. POST /book-day-order                   │
      │                          ├─────────────────────>│                    │
      │                          │                      │ 9. Validate data   │
      │                          │                      │    & Create appt   │
      │                          │                      ├───────────────────>│
      │                          │                      │ 10. Create appt    │
      │                          │                      │     & zoom meeting │
      │                          │                      │                    │
      │                          │                      │<──── Success ──────┤
      │                          │                      │                    │
      │    Confirmation          │                      │ 11. Send Email    │
      │<──────────────────────────┤<──────────────────────┤                    │
      │                          │                      │                    │
      │ 12. Redirected to        │                      │                    │
      │     Appointments          │                      │                    │
      │                          │                      │                    │
```

## State Changes During Booking

```
Initial State:
┌─────────────────────────────────┐
│ Day Order: None                 │
│ Date: None                      │
│ Counselor: None                 │
│ Time Slot: None                 │
└─────────────────────────────────┘

After Step 1 (Select Day Order):
┌─────────────────────────────────┐
│ Day Order: Day Order 1 ✓         │
│ Date: None                      │
│ Counselor: None                 │
│ Time Slot: None                 │
└─────────────────────────────────┘

After Step 2 (Select Date):
┌─────────────────────────────────┐
│ Day Order: Day Order 1 ✓         │
│ Date: 2024-02-20 ✓              │
│ Counselor: None                 │
│ Time Slot: None                 │
│ [Fetch counselors...]           │
└─────────────────────────────────┘

After Step 3 (Select Counselor):
┌─────────────────────────────────┐
│ Day Order: Day Order 1 ✓         │
│ Date: 2024-02-20 ✓              │
│ Counselor: Dr. John ✓           │
│ Time Slot: None                 │
└─────────────────────────────────┘

After Step 4 (Select Time Slot):
┌─────────────────────────────────┐
│ Day Order: Day Order 1 ✓         │
│ Date: 2024-02-20 ✓              │
│ Counselor: Dr. John ✓           │
│ Time Slot: 10:00-10:30 ✓        │
│ Status: Ready to Confirm        │
└─────────────────────────────────┘

After Confirmation:
┌─────────────────────────────────┐
│ Booking Status: SUCCESS ✓        │
│ Appointment created             │
│ Email sent                      │
│ Redirecting...                  │
└─────────────────────────────────┘
```

## Component Hierarchy

```
App.js (Routing)
│
└── /book-appointment route
    │
    └── StudentOnlyRoute
        │
        └── BookAppointmentDayOrder.js (Main Component)
            │
            ├── Step 1: Day Order Selector
            │   └── <select> dropdown
            │
            ├── Step 2: Date Picker
            │   └── <input type="date">
            │
            ├── Step 3: Counselor Grid
            │   └── Counselor Cards
            │       ├── Availability Badge
            │       ├── Time Info
            │       └── Click handler
            │
            ├── Step 4: Time Slots
            │   └── Slot Buttons
            │
            ├── Step 5: Notes
            │   └── <textarea>
            │
            ├── Booking Summary
            │   └── Summary details
            │
            └── Confirm Button
                └── Book appointment
```

## Error Handling Flow

```
Try to Book Appointment
        │
        ├──> Validation Checks
        │    ├─ All fields filled? ──NO──> Show Error
        │    ├─ Date valid? ──NO──> Show Error
        │    └─ All selected? ──NO──> Show Error
        │
        └──> API Call /book-day-order
             │
             ├──> Server Validation
             │    ├─ Auth valid? ──NO──> 403 Forbidden
             │    ├─ User is student? ──NO──> 403 Forbidden
             │    ├─ Counselor available? ──NO──> 409 Conflict
             │    ├─ Slot still free? ──NO──> 409 Conflict
             │    └─ All valid? ──YES──>
             │
             └──> Success
                  ├─ Create appointment
                  ├─ Create Zoom meeting
                  ├─ Send email
                  └─ Return success + 201
```

## API Response Examples

### Get Day Orders
```json
{
  "dayOrders": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "order_name": "Day Order 1",
      "order_number": 1,
      "description": "First rotation day",
      "is_active": true,
      "created_at": "2024-01-15T10:00:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "order_name": "Day Order 2",
      "order_number": 2,
      "description": "Second rotation day",
      "is_active": true,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Get Available Counselors
```json
{
  "counsellors": [
    {
      "availability_id": "uuid1",
      "counsellor_id": "uuid2",
      "counsellor_name": "Dr. John Doe",
      "designation": "Senior Counselor",
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
        {
          "start_time": "10:30",
          "end_time": "11:00",
          "available": true
        }
      ],
      "booked_count": 3
    },
    {
      "availability_id": "uuid3",
      "counsellor_id": "uuid4",
      "counsellor_name": "Dr. Sarah Smith",
      "designation": "Counselor",
      "department": "Mental Health",
      "room_no": "205",
      "phone_no": "9876543211",
      "start_time": "14:00",
      "end_time": "20:00",
      "is_available": false,
      "available_slots": [],
      "booked_count": 13
    }
  ],
  "date": "2024-02-20",
  "dayOrderId": "uuid"
}
```

### Book Appointment Success
```json
{
  "success": true,
  "appointment": {
    "id": "appt-uuid",
    "student_id": "student-uuid",
    "counsellor_id": "counsellor-uuid",
    "day_order_id": "day-order-uuid",
    "date": "2024-02-20",
    "start_time": "10:00",
    "end_time": "10:30",
    "status": "scheduled",
    "notes": null,
    "counsellorName": "Dr. John Doe",
    "dayOrder": "Day Order 1",
    "zoomMeeting": {
      "id": "zoom-uuid",
      "meeting_number": "12345678",
      "join_url": "https://zoom.us/j/12345678",
      "password": "123456"
    }
  },
  "message": "Appointment booked successfully!"
}
```

---

This visual guide should help you understand the system at a glance!
