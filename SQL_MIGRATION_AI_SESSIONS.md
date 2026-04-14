---
description: SQL Migration to create sessions table for persistent JSONB memory
---

# AI Session Memory Migration

Run this SQL query in your Supabase SQL Editor to enable the persistent chat history using JSONB format as recently updated:

```sql
-- Remove previous chat messages if necessary
DROP TABLE IF EXISTS chat_messages;

-- Create table to store the entire session logic per user using JSONB
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    messages JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: We do ONE session per user for simplicity (continuous memory). 
-- Over time you can segment sessions if needed.

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Allow users to read and update their own sessions
CREATE POLICY "Users can manage their own sessions"
    ON sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow counsellors to read sessions of booked students for the pre-session brief
CREATE POLICY "Counsellors can view student sessions"
    ON sessions FOR SELECT
    USING (
        auth.uid() IN (
            SELECT counsellor_id 
            FROM appointments 
            WHERE appointments.student_id = sessions.user_id
        )
    );

-- Fast lookup index
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
```
