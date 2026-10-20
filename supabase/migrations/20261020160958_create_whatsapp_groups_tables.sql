/*
# WhatsApp Groups API — create/manage groups via Cloud API

Stores groups created through the WhatsApp Groups API (Meta Cloud API).
Groups are invite-only; participants join via an invite link that Meta
returns as a webhook after group creation.

1. Tables
- `wa_groups` — one row per group created on a WhatsApp business number.
  - id (uuid PK)
  - user_id (uuid, owner, defaults to auth.uid())
  - wa_group_id (text, unique) — the group ID returned by Meta
  - wa_settings_id (uuid, nullable) — which WhatsApp number created it
  - subject (text) — group name
  - description (text, nullable)
  - invite_link (text, nullable) — https://chat.whatsapp.com/...
  - join_approval_mode (text, default 'auto_approve')
  - participant_count (integer, default 0)
  - status (text, default 'active') — active | suspended | deleted
  - group_photo_url (text, nullable)
  - meta_created_at (timestamptz, nullable) — timestamp from Meta
  - created_at, updated_at

- `wa_group_messages` — messages sent/received inside a group.
  - id (uuid PK)
  - group_id (uuid FK -> wa_groups.id ON DELETE CASCADE)
  - user_id (uuid, owner)
  - sender (text) — 'admin' | 'client'
  - sender_wa_id (text, nullable) — wa_id of the sender (for inbound)
  - sender_name (text, nullable)
  - message_type (text) — text | image | video | audio | document | template
  - text_content (text, nullable)
  - media_id (text, nullable)
  - mime_type (text, nullable)
  - file_name (text, nullable)
  - wa_message_id (text, nullable)
  - delivery_status (text, nullable)
  - created_at

2. RLS — owner-scoped CRUD via auth.uid() = user_id, 4 policies each.
3. Realtime enabled on both tables.
*/

CREATE TABLE IF NOT EXISTS wa_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  wa_group_id text UNIQUE,
  wa_settings_id uuid,
  subject text NOT NULL,
  description text,
  invite_link text,
  join_approval_mode text NOT NULL DEFAULT 'auto_approve',
  participant_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  group_photo_url text,
  meta_created_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wa_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_groups" ON wa_groups;
CREATE POLICY "select_own_wa_groups" ON wa_groups FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_groups" ON wa_groups;
CREATE POLICY "insert_own_wa_groups" ON wa_groups FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wa_groups" ON wa_groups;
CREATE POLICY "update_own_wa_groups" ON wa_groups FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wa_groups" ON wa_groups;
CREATE POLICY "delete_own_wa_groups" ON wa_groups FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS wa_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES wa_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'admin',
  sender_wa_id text,
  sender_name text,
  message_type text NOT NULL DEFAULT 'text',
  text_content text,
  media_id text,
  mime_type text,
  file_name text,
  wa_message_id text,
  delivery_status text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wa_group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_group_messages" ON wa_group_messages;
CREATE POLICY "select_own_wa_group_messages" ON wa_group_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_group_messages" ON wa_group_messages;
CREATE POLICY "insert_own_wa_group_messages" ON wa_group_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wa_group_messages" ON wa_group_messages;
CREATE POLICY "update_own_wa_group_messages" ON wa_group_messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wa_group_messages" ON wa_group_messages;
CREATE POLICY "delete_own_wa_group_messages" ON wa_group_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_groups_user ON wa_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_groups_settings ON wa_groups(wa_settings_id);
CREATE INDEX IF NOT EXISTS idx_wa_group_messages_group ON wa_group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_wa_group_messages_user ON wa_group_messages(user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE wa_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE wa_group_messages;