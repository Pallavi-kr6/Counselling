---
description: SQL Migration to create mood_logs table for AI sentiment analysis
---

# Mood Logs Migration

Run this SQL query in your Supabase SQL Editor to enable AI sentiment tracking over time:

```sql
-- Create table to store background sentiment analysis logs
CREATE TABLE mood_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
    label VARCHAR(20) NOT NULL CHECK (label IN ('positive', 'neutral', 'distressed', 'crisis')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own mood logs
CREATE POLICY "Users can view their own mood logs"
    ON mood_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Allow system to insert logs implicitly through API (bypassing RLS via Service Role)
-- but just in case:
CREATE POLICY "Users can insert mood logs"
    ON mood_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Fast lookup indexes
CREATE INDEX idx_mood_logs_user_id ON mood_logs(user_id);
CREATE INDEX idx_mood_logs_created_at ON mood_logs(created_at);
```
