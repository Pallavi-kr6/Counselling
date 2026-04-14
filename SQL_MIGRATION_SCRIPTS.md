# Day Order System - SQL Migration Scripts

Use these scripts to migrate your existing database to the day order-based booking system.

## Step 1: Create Day Orders Table

```sql
-- Create day_orders table
CREATE TABLE IF NOT EXISTS day_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_name TEXT NOT NULL UNIQUE,
  order_number INTEGER NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default day orders
INSERT INTO day_orders (order_name, order_number, description, is_active) VALUES
  ('Day Order 1', 1, 'First rotation day', TRUE),
  ('Day Order 2', 2, 'Second rotation day', TRUE),
  ('Day Order 3', 3, 'Third rotation day', TRUE),
  ('Day Order 4', 4, 'Fourth rotation day', TRUE)
ON CONFLICT DO NOTHING;
```

## Step 2: Update Counsellor Availability Table

```sql
-- Add new column day_order_id to counsellor_availability
ALTER TABLE counsellor_availability 
ADD COLUMN IF NOT EXISTS day_order_id UUID REFERENCES day_orders(id) ON DELETE CASCADE;

-- Add unique constraint for (counsellor_id, day_order_id)
ALTER TABLE counsellor_availability 
ADD CONSTRAINT unique_counsellor_day_order 
UNIQUE (counsellor_id, day_order_id);

-- Optional: Remove unique constraint on (counsellor_id, day_of_week) if migrating completely
-- ALTER TABLE counsellor_availability DROP CONSTRAINT IF EXISTS unique_counsellor_day_of_week;
```

## Step 3: Update Appointments Table

```sql
-- Add day_order_id column to appointments
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS day_order_id UUID REFERENCES day_orders(id) ON DELETE CASCADE;

-- Create index for day_order_id
CREATE INDEX IF NOT EXISTS idx_appointments_day_order ON appointments(day_order_id);
```

## Step 4: Create Additional Indexes

```sql
-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_day_order ON counsellor_availability(day_order_id);
CREATE INDEX IF NOT EXISTS idx_day_orders_active ON day_orders(is_active);
```

## Step 5: Migrate Existing Availability Data (Optional)

If you have existing counsellor_availability records with `day_of_week`, map them to day orders:

```sql
-- Option 1: Simple mapping - day_of_week (0-6) to day orders (1-4)
-- Map: Sun(0)->1, Mon(1)->1, Tue(2)->2, Wed(3)->2, Thu(4)->3, Fri(5)->3, Sat(6)->4
UPDATE counsellor_availability ca
SET day_order_id = (
  SELECT id FROM day_orders 
  WHERE order_number = CASE 
    WHEN ca.day_of_week IN (0, 1) THEN 1
    WHEN ca.day_of_week IN (2, 3) THEN 2
    WHEN ca.day_of_week IN (4, 5) THEN 3
    ELSE 4
  END
)
WHERE day_order_id IS NULL AND day_of_week IS NOT NULL;

-- Option 2: Manual mapping for specific counsellors
-- First, see which counsellors have availability records
SELECT DISTINCT counsellor_id, day_of_week FROM counsellor_availability;

-- Then map each manually
UPDATE counsellor_availability 
SET day_order_id = (SELECT id FROM day_orders WHERE order_number = 1)
WHERE counsellor_id = 'specific-counsellor-uuid' AND day_of_week = 0;
```

## Step 6: Update Appointments with Day Order Info (Optional)

If you have existing appointments and want to populate day_order_id:

```sql
-- This requires mapping logic based on the date of the appointment
-- Example: Map based on when the appointment was created or a specific rule

-- Method 1: Use a specific day order for all existing appointments (temporary)
UPDATE appointments 
SET day_order_id = (SELECT id FROM day_orders WHERE order_number = 1)
WHERE day_order_id IS NULL;

-- Method 2: Map based on appointment date's day of week (if you have the mapping logic)
-- This would require a similar mapping as counsellor_availability
```

## Step 7: Add Sample Counsellor Availability

```sql
-- Get day order IDs
SELECT id, order_name FROM day_orders;

-- Add availability for a counsellor (replace with actual counsellor_id and day_order_id)
INSERT INTO counsellor_availability (counsellor_id, day_order_id, start_time, end_time, is_available)
VALUES 
  ('your-counsellor-uuid', (SELECT id FROM day_orders WHERE order_number = 1), '10:00', '18:00', true),
  ('your-counsellor-uuid', (SELECT id FROM day_orders WHERE order_number = 2), '14:00', '20:00', true),
  ('your-counsellor-uuid', (SELECT id FROM day_orders WHERE order_number = 3), '09:00', '17:00', true)
ON CONFLICT DO NOTHING;
```

## Step 8: Verify Migration

```sql
-- Check day orders
SELECT * FROM day_orders;

-- Check counsellor availability with day orders
SELECT ca.*, do.order_name 
FROM counsellor_availability ca
LEFT JOIN day_orders do ON ca.day_order_id = do.id;

-- Check counsellors without day order availability (if migrating)
SELECT DISTINCT counsellor_id 
FROM counsellor_availability 
WHERE day_order_id IS NULL;

-- Check appointments structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointments';
```

## Step 9: Optional - Remove Old day_of_week Column

**Only run this after confirming all data has been migrated to day_order_id**

```sql
-- Drop the day_of_week column from counsellor_availability
ALTER TABLE counsellor_availability DROP COLUMN IF EXISTS day_of_week CASCADE;

-- Drop the unique constraint if it exists
ALTER TABLE counsellor_availability DROP CONSTRAINT IF EXISTS unique_counsellor_day_of_week;
```

## Rollback Instructions (if needed)

If you need to rollback these changes:

```sql
-- Remove day_order_id columns
ALTER TABLE appointments DROP COLUMN IF EXISTS day_order_id CASCADE;
ALTER TABLE counsellor_availability DROP COLUMN IF EXISTS day_order_id CASCADE;

-- Restore day_of_week column (if you removed it)
ALTER TABLE counsellor_availability 
ADD COLUMN day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6);

-- Drop day_orders table
DROP TABLE IF EXISTS day_orders CASCADE;

-- Drop new indexes
DROP INDEX IF EXISTS idx_counsellor_availability_day_order;
DROP INDEX IF EXISTS idx_day_orders_active;
DROP INDEX IF EXISTS idx_appointments_day_order;
```

## Notes

1. **Backup First**: Always backup your database before running migration scripts
2. **Test Thoroughly**: Test in a development environment before production
3. **Existing Data**: Existing appointments will continue to work (day_order_id can be NULL initially)
4. **Counsellor Setup**: Update counsellor availability setup UI/forms to use day orders instead of day_of_week
5. **Performance**: New indexes improve query performance for day order lookups

## Migration Order

1. Create day_orders table and insert values
2. Add day_order_id column to counsellor_availability
3. Add day_order_id column to appointments
4. Create new indexes
5. Migrate existing data (optional)
6. Update frontend and backend code
7. Test thoroughly
8. Remove old day_of_week column (optional, after testing)
