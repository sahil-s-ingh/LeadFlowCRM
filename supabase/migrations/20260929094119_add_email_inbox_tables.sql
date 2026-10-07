/*
# Add IMAP settings + email inbox tables

1. Modified Tables
- `smtp_settings`: Added IMAP columns for receiving emails
  - imap_host (text) — e.g. imap.hostinger.com
  - imap_port (int, default 993)
  - imap_username (text) — usually same as smtp_username
  - imap_password (text) — usually same as smtp_password
  - imap_use_tls (boolean, default true)

2. New Tables
- `email_inbox_conversations`: One row per email thread/contact
  - id (uuid PK)
  - user_id (uuid, owner, defaults to auth.uid())
  - from_email (text) — sender's email address
  - from_name (text, nullable) — sender's display name
  - subject (text) — email subject line
  - last_message_text (text) — preview for conversation list
  - last_message_at (timestamptz) — for sorting
  - unread_count (int, default 0)
  - lead_id (uuid, nullable — link to CRM lead if matched by email)
  - created_at (timestamptz)

- `email_inbox_messages`: Individual emails within a conversation
  - id (uuid PK)
  - conversation_id (uuid FK → email_inbox_conversations ON DELETE CASCADE)
  - user_id (uuid, owner, defaults to auth.uid())
  - from_email (text)
  - from_name (text, nullable)
  - to_email (text)
  - subject (text)
  - body_text (text) — plain text body
  - body_html (text, nullable) — HTML body
  - direction (text) — 'incoming' | 'outgoing'
  - message_id (text, nullable) — RFC Message-ID header for threading
  - in_reply_to (text, nullable) — RFC In-Reply-To header
  - is_read (boolean, default false)
  - has_attachments (boolean, default false)
  - attachments (jsonb, default '[]') — array of {filename, contentType, size}
  - created_at (timestamptz)

3. Security
- RLS enabled on all new tables.
- Owner-scoped CRUD: authenticated users can only access their own data.
- Messages scoped through conversation ownership.
*/

-- Add IMAP columns to smtp_settings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'smtp_settings' AND column_name = 'imap_host') THEN
    ALTER TABLE smtp_settings ADD COLUMN imap_host text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'smtp_settings' AND column_name = 'imap_port') THEN
    ALTER TABLE smtp_settings ADD COLUMN imap_port int DEFAULT 993;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'smtp_settings' AND column_name = 'imap_username') THEN
    ALTER TABLE smtp_settings ADD COLUMN imap_username text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'smtp_settings' AND column_name = 'imap_password') THEN
    ALTER TABLE smtp_settings ADD COLUMN imap_password text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'smtp_settings' AND column_name = 'imap_use_tls') THEN
    ALTER TABLE smtp_settings ADD COLUMN imap_use_tls boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Email inbox conversations table
CREATE TABLE IF NOT EXISTS email_inbox_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  from_email text NOT NULL,
  from_name text,
  subject text NOT NULL DEFAULT '',
  last_message_text text,
  last_message_at timestamptz,
  unread_count int NOT NULL DEFAULT 0,
  lead_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_inbox_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_email_conversations" ON email_inbox_conversations;
CREATE POLICY "select_own_email_conversations" ON email_inbox_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_email_conversations" ON email_inbox_conversations;
CREATE POLICY "insert_own_email_conversations" ON email_inbox_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_email_conversations" ON email_inbox_conversations;
CREATE POLICY "update_own_email_conversations" ON email_inbox_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_email_conversations" ON email_inbox_conversations;
CREATE POLICY "delete_own_email_conversations" ON email_inbox_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Email inbox messages table
CREATE TABLE IF NOT EXISTS email_inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES email_inbox_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  from_email text NOT NULL,
  from_name text,
  to_email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  body_html text,
  direction text NOT NULL DEFAULT 'incoming' CHECK (direction IN ('incoming', 'outgoing')),
  message_id text,
  in_reply_to text,
  is_read boolean NOT NULL DEFAULT false,
  has_attachments boolean NOT NULL DEFAULT false,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_inbox_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_email_messages" ON email_inbox_messages;
CREATE POLICY "select_own_email_messages" ON email_inbox_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_email_messages" ON email_inbox_messages;
CREATE POLICY "insert_own_email_messages" ON email_inbox_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_email_messages" ON email_inbox_messages;
CREATE POLICY "update_own_email_messages" ON email_inbox_messages
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_email_messages" ON email_inbox_messages;
CREATE POLICY "delete_own_email_messages" ON email_inbox_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_inbox_messages_conversation ON email_inbox_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_email_inbox_conversations_user_last ON email_inbox_conversations(user_id, last_message_at DESC);

-- Enable realtime for email inbox tables
ALTER TABLE email_inbox_conversations REPLICA IDENTITY FULL;
ALTER TABLE email_inbox_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'email_inbox_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE email_inbox_conversations;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'email_inbox_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE email_inbox_messages;
  END IF;
END $$;
