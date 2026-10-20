/*
# Instagram Messaging Integration

## What this does
Adds tables to support Instagram DM automation through Meta's Messenger Platform for Instagram.
Mirrors the existing WhatsApp conversation architecture (wa_conversations + wa_messages).

## New Tables
- instagram_settings: per-user Instagram connection (ig_user_id, page_id, page_access_token, handle)
- ig_conversations: one row per DM thread (ig_sender_id, sender_username, unread_count, lead_id)
- ig_messages: individual messages (sender admin/client, text_content, media_url, ig_message_id)

## Security
- RLS enabled on all three tables with owner-scoped (auth.uid() = user_id) policies.
- Service-role edge function bypasses RLS to insert incoming webhook messages.
*/

CREATE TABLE IF NOT EXISTS instagram_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_user_id text,
  page_id text,
  page_access_token text,
  connected_username text,
  welcome_message text DEFAULT 'Hi! Thanks for reaching out. Our team will get back to you shortly.',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE instagram_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ig_settings" ON instagram_settings;
CREATE POLICY "select_own_ig_settings" ON instagram_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ig_settings" ON instagram_settings;
CREATE POLICY "insert_own_ig_settings" ON instagram_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ig_settings" ON instagram_settings;
CREATE POLICY "update_own_ig_settings" ON instagram_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ig_settings" ON instagram_settings;
CREATE POLICY "delete_own_ig_settings" ON instagram_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ig_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_settings_id uuid REFERENCES instagram_settings(id) ON DELETE CASCADE,
  ig_sender_id text,
  sender_username text,
  sender_name text,
  sender_profile_pic text,
  last_message_text text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  lead_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ig_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ig_conversations" ON ig_conversations;
CREATE POLICY "select_own_ig_conversations" ON ig_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ig_conversations" ON ig_conversations;
CREATE POLICY "insert_own_ig_conversations" ON ig_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ig_conversations" ON ig_conversations;
CREATE POLICY "update_own_ig_conversations" ON ig_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ig_conversations" ON ig_conversations;
CREATE POLICY "delete_own_ig_conversations" ON ig_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ig_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ig_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'client',
  message_type text NOT NULL DEFAULT 'text',
  text_content text,
  media_url text,
  ig_message_id text UNIQUE,
  delivery_status text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ig_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ig_messages" ON ig_messages;
CREATE POLICY "select_own_ig_messages" ON ig_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ig_messages" ON ig_messages;
CREATE POLICY "insert_own_ig_messages" ON ig_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ig_messages" ON ig_messages;
CREATE POLICY "update_own_ig_messages" ON ig_messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ig_messages" ON ig_messages;
CREATE POLICY "delete_own_ig_messages" ON ig_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ig_conversations_user_id ON ig_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ig_conversations_settings ON ig_conversations(ig_settings_id);
CREATE INDEX IF NOT EXISTS idx_ig_messages_conversation_id ON ig_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ig_messages_user_id ON ig_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ig_messages_ig_message_id ON ig_messages(ig_message_id);

ALTER TABLE ig_conversations REPLICA IDENTITY FULL;
ALTER TABLE ig_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE ig_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE ig_messages;
