# Fix "0 Available Slots" Issue - TODO

## Task: Fix the issue where counsellor availability shows 0 slots even when data exists in database

### Issues Identified:
1. **Bug in `/slots/:counsellorId` endpoint**: Uses `new Date(date).getDay()` which returns 0-6, but `day_order_id` is a UUID
2. **Missing endpoints**: Client expects endpoints that don't exist in server

### Fix Plan:

- [x] 1. Fix `/slots/:counsellorId` endpoint in server/routes/appointments.js
       - Added logic to map day of week to correct day_order using (dayOfWeek % 4) + 1 mapping
       - Now fetches all availability and filters to find matching day_order

- [x] 2. Add `GET /day-orders` endpoint to get all day orders
       - Returns list of day orders with their IDs

- [x] 3. Add `GET /day-order/:id/available-counsellors` endpoint
       - Returns available counsellors for a specific day order

- [x] 4. Add `POST /book-day-order` endpoint
       - Books an appointment using day order ID instead of date

- [ ] 5. Test the fixes

### Status: Completed - All fixes implemented
