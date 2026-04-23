-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (base authentication)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  user_type TEXT NOT NULL CHECK (user_type IN ('student', 'counsellor')),
  is_anonymous BOOLEAN DEFAULT FALSE,
  nickname TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Student profiles
CREATE TABLE IF NOT EXISTS student_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  year TEXT,
  course TEXT,
  gender TEXT,
  contact_info TEXT,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Counsellor profiles
CREATE TABLE IF NOT EXISTS counsellor_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  designation TEXT,
  teacher_id TEXT UNIQUE,
  gmail TEXT,
  room_no TEXT,
  phone_no TEXT,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Day orders (e.g., Day Order 1, Day Order 2, etc.)
CREATE TABLE IF NOT EXISTS day_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_name TEXT NOT NULL UNIQUE, -- e.g., "Day Order 1", "Day Order 2"
  order_number INTEGER NOT NULL UNIQUE, -- 1, 2, 3, 4
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Counsellor availability (refactored for day orders)
-- Allows multiple time slots per counselor per day order
-- Prevents duplicate identical slots: UNIQUE(counsellor_id, day_order_id, start_time, end_time)
CREATE TABLE IF NOT EXISTS counsellor_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  counsellor_id UUID REFERENCES counsellor_profiles(user_id) ON DELETE CASCADE,
  day_order_id UUID REFERENCES day_orders(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(counsellor_id, day_order_id, start_time, end_time)
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  counsellor_id UUID REFERENCES counsellor_profiles(user_id) ON DELETE CASCADE,
  day_order_id UUID REFERENCES day_orders(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed')),
  completed_at TIMESTAMP WITH TIME ZONE,
  followup_at TIMESTAMP WITH TIME ZONE,
  student_followup_sent_at TIMESTAMP WITH TIME ZONE,
  counsellor_followup_sent_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mood tracking
CREATE TABLE IF NOT EXISTS mood_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mood INTEGER CHECK (mood BETWEEN 1 AND 10), -- 1 = very low, 10 = very high
  emoji TEXT,
  notes TEXT,
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  sleep_hours DECIMAL(4,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Resources library
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('article', 'video', 'podcast', 'toolkit')),
  category TEXT, -- 'stress', 'exam-pressure', 'time-management', 'relationships', etc.
  url TEXT,
  content TEXT,
  tags TEXT[],
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resource views tracking
CREATE TABLE IF NOT EXISTS resource_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session feedback
CREATE TABLE IF NOT EXISTS session_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  counsellor_id UUID REFERENCES counsellor_profiles(user_id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(appointment_id)
);

-- Weekly counseling progress reports
CREATE TABLE IF NOT EXISTS progress_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  counsellor_id UUID REFERENCES counsellor_profiles(user_id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  student_name TEXT,
  register_number TEXT,
  department_year TEXT,
  counsellor_name TEXT,
  academic_performance JSONB, -- Array of subjects with scores, attendance, remarks
  previous_goals_review JSONB, -- Array of goals with status and reasons
  issues_challenges TEXT[], -- Selected issues
  other_issues TEXT,
  counseling_support JSONB, -- Object with different support types
  next_week_plan JSONB, -- Array of goals with steps and responsible persons
  counsellor_remarks TEXT,
  student_commitment BOOLEAN DEFAULT FALSE,
  student_signature TEXT,
  student_signature_date DATE,
  counsellor_signature TEXT,
  counsellor_signature_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, week_start)
);

-- Zoom meetings
CREATE TABLE IF NOT EXISTS zoom_meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  meeting_number TEXT NOT NULL,
  meeting_password TEXT,
  start_url TEXT,
  join_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(appointment_id)
);

-- Emergency contacts
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  type TEXT CHECK (type IN ('campus', 'national', 'faculty')),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default emergency contacts
INSERT INTO emergency_contacts (name, phone, type, description) VALUES
  ('KIRAN Helpline', '9152987821', 'national', 'National Mental Health Helpline - 24/7'),
  ('Campus Helpline', 'YOUR_CAMPUS_PHONE', 'campus', 'College Campus Emergency Helpline')
ON CONFLICT DO NOTHING;

-- Insert default day orders
INSERT INTO day_orders (order_name, order_number, description, is_active) VALUES
  ('Day Order 1', 1, 'First rotation day', TRUE),
  ('Day Order 2', 2, 'Second rotation day', TRUE),
  ('Day Order 3', 3, 'Third rotation day', TRUE),
  ('Day Order 4', 4, 'Fourth rotation day', TRUE),
  ('Day Order 5', 5, 'Fifth rotation day', TRUE)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_appointments_student ON appointments(student_id);
CREATE INDEX IF NOT EXISTS idx_appointments_counsellor ON appointments(counsellor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_day_order ON appointments(day_order_id);
CREATE INDEX IF NOT EXISTS idx_appointments_followup_due ON appointments(status, followup_at);
CREATE INDEX IF NOT EXISTS idx_mood_tracking_user_date ON mood_tracking(user_id, date);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_day_order ON counsellor_availability(day_order_id);
CREATE INDEX IF NOT EXISTS idx_day_orders_active ON day_orders(is_active);

-- Additional performance indexes for multiple time slots support
-- Index for checking if a time slot is already booked (prevents double-booking)
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_no_double_booking
ON appointments (counsellor_id, date, start_time, end_time)
WHERE status IN ('scheduled', 'confirmed', 'completed');

-- Index for fetching available counsellors by day order efficiently
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_day_order_active
ON counsellor_availability (day_order_id, is_available)
WHERE is_available = true;

-- Index for finding counsellor's availability for a specific day order
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_counsellor_day_order
ON counsellor_availability (counsellor_id, day_order_id);

-- Index for time-based queries on availability
CREATE INDEX IF NOT EXISTS idx_counsellor_availability_times
ON counsellor_availability (start_time, end_time);

-- Index for finding active appointments by slot
CREATE INDEX IF NOT EXISTS idx_appointments_slot_check
ON appointments (counsellor_id, date, start_time, end_time)
WHERE status IN ('scheduled', 'confirmed', 'completed');

-- Index for finding student's active appointments
CREATE INDEX IF NOT EXISTS idx_appointments_student_active
ON appointments (student_id, status)
WHERE status IN ('scheduled', 'confirmed', 'completed');

-- Index for finding counsellor's appointments by date
CREATE INDEX IF NOT EXISTS idx_appointments_counsellor_date
ON appointments (counsellor_id, date, status);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE counsellor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Policy: Students can view their own profile
CREATE POLICY "Students can view own profile" ON student_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Counsellors can view all student profiles (for appointments)
CREATE POLICY "Counsellors can view student profiles" ON student_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appointments
      WHERE appointments.counsellor_id = auth.uid()
      AND appointments.student_id = student_profiles.user_id
    )
  );

-- Policy: Counsellors can view all counsellor profiles
CREATE POLICY "Counsellors visible to all" ON counsellor_profiles
  FOR SELECT USING (true);--

-- Policy: Users can view their own appointments
CREATE POLICY "Users can view own appointments" ON appointments
  FOR SELECT USING (student_id = auth.uid() OR counsellor_id = auth.uid());

-- Policy: Users can view their own mood tracking
CREATE POLICY "Users can view own mood" ON mood_tracking
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Counsellors can view student mood (for reports)
CREATE POLICY "Counsellors can view student mood" ON mood_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appointments
      WHERE appointments.counsellor_id = auth.uid()
      AND appointments.student_id = mood_tracking.user_id
    )
  );
