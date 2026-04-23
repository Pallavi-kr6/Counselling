---
description: SQL Migration to create questionnaire_responses table for PHQ-9
---

# Questionnaire Responses Migration

Run this SQL query in your Supabase SQL Editor to enable the PHQ-9 pre-appointment assessments:

```sql
CREATE TABLE questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    type VARCHAR(50) DEFAULT 'PHQ-9',
    responses JSONB NOT NULL,
    total_score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- Allow users to insert and read their own responses
CREATE POLICY "Users can insert their own responses"
    ON questionnaire_responses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own responses"
    ON questionnaire_responses FOR SELECT
    USING (auth.uid() = user_id);

-- Allow counsellors to read responses of their students
CREATE POLICY "Counsellors can view student responses"
    ON questionnaire_responses FOR SELECT
    USING (
        auth.uid() IN (
            SELECT counsellor_id 
            FROM appointments 
            WHERE appointments.id = questionnaire_responses.appointment_id
        )
    );

CREATE INDEX idx_questionnaire_user_id ON questionnaire_responses(user_id);
CREATE INDEX idx_questionnaire_appointment_id ON questionnaire_responses(appointment_id);
```
