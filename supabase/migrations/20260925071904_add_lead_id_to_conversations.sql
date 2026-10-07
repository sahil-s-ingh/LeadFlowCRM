-- Add lead_id to conversation tables to link chats to leads in the pipeline
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS lead_id uuid;
ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS lead_id uuid;
