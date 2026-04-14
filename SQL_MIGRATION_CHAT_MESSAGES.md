---
description: SQL Migration to create chat_messages table for Pre-session Brief feature
---

# Chat Messages & AI Brief Migration

Run this SQL query in your Supabase SQL Editor to enable the chat history and counselor pre-session brief functionality:

```sql
-- Create table to store student conversations with the AI bot
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create an index for faster queries by the AI Brief endpoint
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
```
