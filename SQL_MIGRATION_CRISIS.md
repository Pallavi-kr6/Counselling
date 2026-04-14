---
description: SQL Migration to create crisis_flags table for logging client-side crisis detection
---

# Crisis Flags Migration

Run this SQL query in your Supabase SQL Editor to track triggered self-harm/crisis keywords:

```sql
CREATE TABLE crisis_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE crisis_flags ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own flags
CREATE POLICY "Users can insert their own crisis flags"
    ON crisis_flags FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Counsellors and Admins can view flags
CREATE POLICY "Staff can view crisis flags"
    ON crisis_flags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.user_type IN ('counsellor', 'admin')
        )
    );

CREATE INDEX idx_crisis_user_id ON crisis_flags(user_id);
```
