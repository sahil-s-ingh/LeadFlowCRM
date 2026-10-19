/*
# Scheduled & Starred WhatsApp Messages

1. New Tables
- `wa_scheduled_messages` — WhatsApp messages composed in the lead chat drawer
  but sent automatically at a future date/time by a cron-triggered edge function.
  Columns: id, user_id, conversation_id, lead_id, text, template_name,
  template_language, template_components, scheduled_at, status
  (pending/sent/failed/cancelled), wa_message_id, error_message, created_at.
- `wa_starred_messages` — Bookmarks on specific wa_messages for later follow-up.
  Columns: id, user_id, message_id, conversation_id, note, created_at.

2. Security
- Enable RLS on both tables.
- Owner-scoped CRUD via auth.uid() = user_id on both tables.

3. Cron
- Schedules `process-scheduled-wa-messages` every minute to send due messages.

4. Notes
- Scheduled messages support both plain text and template messages (template
  fields are nullable). The processor calls the existing send-whatsapp-message
  edge function logic directly via the Graph API.
- Starred messages are separate from the existing single pinned message per
  conversation — a user can star unlimited messages across all conversations.
*/

CREATE TABLE IF NOT EXISTS wa_scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES wa_conversations(id) ON DELETE CASCADE,
  lead_id uuid,
  text text,
  template_name text,
  template_language text,
  template_components jsonb,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  wa_message_id text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wa_scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_scheduled_wa" ON wa_scheduled_messages;
CREATE POLICY "select_own_scheduled_wa" ON wa_scheduled_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_scheduled_wa" ON wa_scheduled_messages;
CREATE POLICY "insert_own_scheduled_wa" ON wa_scheduled_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_scheduled_wa" ON wa_scheduled_messages;
CREATE POLICY "update_own_scheduled_wa" ON wa_scheduled_messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_scheduled_wa" ON wa_scheduled_messages;
CREATE POLICY "delete_own_scheduled_wa" ON wa_scheduled_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_scheduled_pending ON wa_scheduled_messages (scheduled_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS wa_starred_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES wa_messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, message_id)
);

ALTER TABLE wa_starred_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_starred_wa" ON wa_starred_messages;
CREATE POLICY "select_own_starred_wa" ON wa_starred_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_starred_wa" ON wa_starred_messages;
CREATE POLICY "insert_own_starred_wa" ON wa_starred_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_starred_wa" ON wa_starred_messages;
CREATE POLICY "delete_own_starred_wa" ON wa_starred_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_starred_conv ON wa_starred_messages (conversation_id, user_id);