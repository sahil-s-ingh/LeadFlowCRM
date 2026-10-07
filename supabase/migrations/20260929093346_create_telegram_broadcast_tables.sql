/*
# Create Telegram Broadcast Campaign tables

1. New Tables
- `tg_broadcast_campaigns`: Stores broadcast campaigns (message text + recipient list + status)
  - id (uuid PK)
  - user_id (uuid, owner, defaults to auth.uid())
  - message_text (text) — the plain text message to broadcast to all recipients
  - status (text) — draft | sending | completed | failed
  - total_recipients (int, default 0)
  - sent_count (int, default 0)
  - failed_count (int, default 0)
  - created_at, updated_at (timestamptz)

- `tg_broadcast_recipients`: Individual recipients within a campaign
  - id (uuid PK)
  - campaign_id (uuid FK → tg_broadcast_campaigns ON DELETE CASCADE)
  - user_id (uuid, owner, defaults to auth.uid())
  - conversation_id (uuid, nullable — link to chat_conversations)
  - telegram_chat_id (bigint) — Telegram numeric chat ID to send to
  - telegram_username (text, nullable) — for display
  - telegram_first_name (text, nullable) — for display
  - status (text) — pending | sent | failed
  - error_message (text, nullable)
  - sent_at (timestamptz, nullable)
  - created_at (timestamptz)

2. Security
- RLS enabled on both tables.
- Owner-scoped CRUD: authenticated users can only access their own campaigns/recipients.
*/

CREATE TABLE IF NOT EXISTS tg_broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message_text text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_recipients int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tg_broadcast_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tg_broadcasts" ON tg_broadcast_campaigns;
CREATE POLICY "select_own_tg_broadcasts" ON tg_broadcast_campaigns
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tg_broadcasts" ON tg_broadcast_campaigns;
CREATE POLICY "insert_own_tg_broadcasts" ON tg_broadcast_campaigns
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tg_broadcasts" ON tg_broadcast_campaigns;
CREATE POLICY "update_own_tg_broadcasts" ON tg_broadcast_campaigns
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tg_broadcasts" ON tg_broadcast_campaigns;
CREATE POLICY "delete_own_tg_broadcasts" ON tg_broadcast_campaigns
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS tg_broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES tg_broadcast_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE SET NULL,
  telegram_chat_id bigint NOT NULL,
  telegram_username text,
  telegram_first_name text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tg_broadcast_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tg_recipients" ON tg_broadcast_recipients;
CREATE POLICY "select_own_tg_recipients" ON tg_broadcast_recipients
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tg_recipients" ON tg_broadcast_recipients;
CREATE POLICY "insert_own_tg_recipients" ON tg_broadcast_recipients
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tg_recipients" ON tg_broadcast_recipients;
CREATE POLICY "update_own_tg_recipients" ON tg_broadcast_recipients
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tg_recipients" ON tg_broadcast_recipients;
CREATE POLICY "delete_own_tg_recipients" ON tg_broadcast_recipients
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tg_broadcast_recipients_campaign_id ON tg_broadcast_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tg_broadcast_campaigns_user_id ON tg_broadcast_campaigns(user_id);
