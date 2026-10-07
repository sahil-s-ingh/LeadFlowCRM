/*
# Telegram bot chat tables

1. New Tables
- `telegram_settings` — stores the bot token per admin
  - `id` uuid PK
  - `user_id` uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE
  - `bot_token` text — Telegram bot API token
  - `bot_username` text — the bot's @username (for display)
  - `welcome_message` text — auto-reply sent when /start is used
  - `created_at` timestamptz DEFAULT now()
  - `updated_at` timestamptz DEFAULT now()
  - UNIQUE(user_id)

- `chat_conversations` — one row per Telegram user who messages the bot
  - `id` uuid PK
  - `user_id` uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE — which admin owns this conversation
  - `telegram_chat_id` bigint NOT NULL — Telegram's numeric chat ID
  - `telegram_user_id` bigint — Telegram user ID
  - `telegram_username` text — @username (without @)
  - `telegram_first_name` text
  - `telegram_last_name` text
  - `last_message_text` text — preview text for the conversation list
  - `last_message_at` timestamptz — for sorting
  - `unread_count` int NOT NULL DEFAULT 0
  - `created_at` timestamptz DEFAULT now()
  - UNIQUE(user_id, telegram_chat_id)

- `chat_messages` — individual messages within a conversation
  - `id` uuid PK
  - `conversation_id` uuid NOT NULL REFERENCES chat_conversations ON DELETE CASCADE
  - `sender` text NOT NULL CHECK (sender IN ('client', 'admin'))
  - `message_type` text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'photo', 'video', 'audio', 'voice', 'document', 'sticker', 'animation', 'location', 'contact'))
  - `text_content` text — the text body (or caption for media)
  - `file_id` text — Telegram file_id for media
  - `file_unique_id` text — Telegram file_unique_id
  - `mime_type` text — for documents/audio
  - `file_size` bigint
  - `file_name` text — for documents
  - `media_width` int
  - `media_height` int
  - `media_duration` int — for audio/video/voice (seconds)
  - `emoji` text — for stickers (emoji representation)
  - `latitude` float8 — for location
  - `longitude` float8 — for location
  - `created_at` timestamptz DEFAULT now()

2. Indexes
- idx_chat_messages_conversation ON chat_messages(conversation_id, created_at)
- idx_chat_conversations_user_last ON chat_conversations(user_id, last_message_at DESC)

3. Security
- RLS enabled on all tables.
- Owner-scoped: admin can only see conversations/settings for their own user_id.
- Messages are accessed through conversation ownership (via a subquery or join).
*/

CREATE TABLE IF NOT EXISTS telegram_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_token text,
  bot_username text,
  welcome_message text DEFAULT 'Hi! Thanks for reaching out. Our team will get back to you shortly.',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id bigint NOT NULL,
  telegram_user_id bigint,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  last_message_text text,
  last_message_at timestamptz,
  unread_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, telegram_chat_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('client', 'admin')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'photo', 'video', 'audio', 'voice', 'document', 'sticker', 'animation', 'location', 'contact')),
  text_content text,
  file_id text,
  file_unique_id text,
  mime_type text,
  file_size bigint,
  file_name text,
  media_width int,
  media_height int,
  media_duration int,
  emoji text,
  latitude float8,
  longitude float8,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_last ON chat_conversations(user_id, last_message_at DESC);

ALTER TABLE telegram_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- telegram_settings: owner-scoped CRUD
DROP POLICY IF EXISTS "select_own_telegram_settings" ON telegram_settings;
CREATE POLICY "select_own_telegram_settings" ON telegram_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_telegram_settings" ON telegram_settings;
CREATE POLICY "insert_own_telegram_settings" ON telegram_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_telegram_settings" ON telegram_settings;
CREATE POLICY "update_own_telegram_settings" ON telegram_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_telegram_settings" ON telegram_settings;
CREATE POLICY "delete_own_telegram_settings" ON telegram_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- chat_conversations: owner-scoped CRUD
DROP POLICY IF EXISTS "select_own_conversations" ON chat_conversations;
CREATE POLICY "select_own_conversations" ON chat_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_conversations" ON chat_conversations;
CREATE POLICY "insert_own_conversations" ON chat_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_conversations" ON chat_conversations;
CREATE POLICY "update_own_conversations" ON chat_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_conversations" ON chat_conversations;
CREATE POLICY "delete_own_conversations" ON chat_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- chat_messages: access through conversation ownership
DROP POLICY IF EXISTS "select_own_messages" ON chat_messages;
CREATE POLICY "select_own_messages" ON chat_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_messages" ON chat_messages;
CREATE POLICY "insert_own_messages" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_messages" ON chat_messages;
CREATE POLICY "update_own_messages" ON chat_messages FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_messages" ON chat_messages;
CREATE POLICY "delete_own_messages" ON chat_messages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );