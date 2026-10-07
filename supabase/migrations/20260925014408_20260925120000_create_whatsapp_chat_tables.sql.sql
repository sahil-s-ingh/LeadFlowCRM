/*
# WhatsApp Business API chat tables

1. New Tables
- `whatsapp_settings` — stores WhatsApp Business API credentials per admin
  - `id` uuid PK
  - `user_id` uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE
  - `phone_number_id` text — Meta WhatsApp Business phone number ID
  - `access_token` text — Meta Graph API access token
  - `verify_token` text — token used for webhook verification with Meta
  - `waba_id` text — WhatsApp Business Account ID (optional)
  - `welcome_message` text — auto-reply sent when a new user messages
  - `created_at` timestamptz DEFAULT now()
  - `updated_at` timestamptz DEFAULT now()
  - UNIQUE(user_id)

- `wa_conversations` — one row per WhatsApp user who messages the business
  - `id` uuid PK
  - `user_id` uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE
  - `wa_phone_number` text NOT NULL — the contact's phone number (E.164)
  - `wa_name` text — display name from WhatsApp profile
  - `wa_wa_id` text — WhatsApp ID (phone number without +)
  - `last_message_text` text — preview text for the conversation list
  - `last_message_at` timestamptz — for sorting
  - `unread_count` int NOT NULL DEFAULT 0
  - `created_at` timestamptz DEFAULT now()
  - UNIQUE(user_id, wa_phone_number)

- `wa_messages` — individual messages within a WhatsApp conversation
  - `id` uuid PK
  - `conversation_id` uuid NOT NULL REFERENCES wa_conversations ON DELETE CASCADE
  - `sender` text NOT NULL CHECK (sender IN ('client', 'admin'))
  - `message_type` text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'voice', 'document', 'sticker', 'location', 'contacts'))
  - `text_content` text — the text body (or caption for media)
  - `media_id` text — Meta media ID for media messages
  - `mime_type` text — for documents/audio
  - `file_size` bigint
  - `file_name` text — for documents
  - `media_width` int
  - `media_height` int
  - `media_duration` int — for audio/video/voice (seconds)
  - `latitude` float8 — for location
  - `longitude` float8 — for location
  - `created_at` timestamptz DEFAULT now()

2. Indexes
- idx_wa_messages_conversation ON wa_messages(conversation_id, created_at)
- idx_wa_conversations_user_last ON wa_conversations(user_id, last_message_at DESC)

3. Security
- RLS enabled on all tables.
- Owner-scoped: admin can only see conversations/settings for their own user_id.
- Messages are accessed through conversation ownership (via a subquery or join).
*/

CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id text,
  access_token text,
  verify_token text,
  waba_id text,
  welcome_message text DEFAULT 'Hi! Thanks for reaching out. Our team will get back to you shortly.',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS wa_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  wa_phone_number text NOT NULL,
  wa_name text,
  wa_wa_id text,
  last_message_text text,
  last_message_at timestamptz,
  unread_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, wa_phone_number)
);

CREATE TABLE IF NOT EXISTS wa_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('client', 'admin')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'voice', 'document', 'sticker', 'location', 'contacts')),
  text_content text,
  media_id text,
  mime_type text,
  file_size bigint,
  file_name text,
  media_width int,
  media_height int,
  media_duration int,
  latitude float8,
  longitude float8,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation ON wa_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_user_last ON wa_conversations(user_id, last_message_at DESC);

ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;

-- whatsapp_settings: owner-scoped CRUD
DROP POLICY IF EXISTS "select_own_whatsapp_settings" ON whatsapp_settings;
CREATE POLICY "select_own_whatsapp_settings" ON whatsapp_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_whatsapp_settings" ON whatsapp_settings;
CREATE POLICY "insert_own_whatsapp_settings" ON whatsapp_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_whatsapp_settings" ON whatsapp_settings;
CREATE POLICY "update_own_whatsapp_settings" ON whatsapp_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_whatsapp_settings" ON whatsapp_settings;
CREATE POLICY "delete_own_whatsapp_settings" ON whatsapp_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- wa_conversations: owner-scoped CRUD
DROP POLICY IF EXISTS "select_own_wa_conversations" ON wa_conversations;
CREATE POLICY "select_own_wa_conversations" ON wa_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_wa_conversations" ON wa_conversations;
CREATE POLICY "insert_own_wa_conversations" ON wa_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_wa_conversations" ON wa_conversations;
CREATE POLICY "update_own_wa_conversations" ON wa_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_wa_conversations" ON wa_conversations;
CREATE POLICY "delete_own_wa_conversations" ON wa_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- wa_messages: access through conversation ownership
DROP POLICY IF EXISTS "select_own_wa_messages" ON wa_messages;
CREATE POLICY "select_own_wa_messages" ON wa_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wa_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_wa_messages" ON wa_messages;
CREATE POLICY "insert_own_wa_messages" ON wa_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM wa_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_wa_messages" ON wa_messages;
CREATE POLICY "update_own_wa_messages" ON wa_messages FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wa_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_wa_messages" ON wa_messages;
CREATE POLICY "delete_own_wa_messages" ON wa_messages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wa_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );