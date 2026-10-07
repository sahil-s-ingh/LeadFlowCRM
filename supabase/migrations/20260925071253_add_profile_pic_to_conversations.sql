-- Add profile picture URL column to chat conversation tables
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS profile_pic_url text;

-- Add profile picture URL column to WhatsApp conversation tables
ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS profile_pic_url text;
