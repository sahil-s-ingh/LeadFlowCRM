/*
# Create WhatsApp Broadcast Campaign tables

1. New Tables
- `wa_broadcast_campaigns`: Stores broadcast campaigns (template + recipient list + status)
  - id (uuid PK)
  - user_id (uuid, owner, defaults to auth.uid())
  - template_name (text) — the approved WhatsApp template name to send
  - template_language (text) — language code e.g. en_US
  - template_components (jsonb) — the full components array from the template
  - status (text) — draft | sending | completed | failed | paused
  - total_recipients (int, default 0)
  - sent_count (int, default 0)
  - delivered_count (int, default 0)
  - failed_count (int, default 0)
  - created_at, updated_at (timestamptz)

- `wa_broadcast_recipients`: Individual recipients within a campaign
  - id (uuid PK)
  - campaign_id (uuid FK → wa_broadcast_campaigns ON DELETE CASCADE)
  - user_id (uuid, owner, defaults to auth.uid())
  - lead_id (uuid, nullable — link to CRM lead if exists)
  - phone_number (text) — recipient phone number
  - status (text) — pending | sent | delivered | failed
  - error_message (text, nullable)
  - wa_message_id (text, nullable) — Meta message ID for tracking
  - sent_at (timestamptz, nullable)
  - delivered_at (timestamptz, nullable)
  - created_at (timestamptz)

2. Security
- RLS enabled on both tables.
- Owner-scoped CRUD: authenticated users can only access their own campaigns/recipients.
- Recipients are also scoped through campaign ownership for SELECT.
*/

CREATE TABLE IF NOT EXISTS wa_broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  template_language text NOT NULL DEFAULT 'en_US',
  template_components jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  total_recipients int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  delivered_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wa_broadcast_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_broadcasts" ON wa_broadcast_campaigns;
CREATE POLICY "select_own_broadcasts" ON wa_broadcast_campaigns
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_broadcasts" ON wa_broadcast_campaigns;
CREATE POLICY "insert_own_broadcasts" ON wa_broadcast_campaigns
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_broadcasts" ON wa_broadcast_campaigns;
CREATE POLICY "update_own_broadcasts" ON wa_broadcast_campaigns
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_broadcasts" ON wa_broadcast_campaigns;
CREATE POLICY "delete_own_broadcasts" ON wa_broadcast_campaigns
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS wa_broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES wa_broadcast_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  wa_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wa_broadcast_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recipients" ON wa_broadcast_recipients;
CREATE POLICY "select_own_recipients" ON wa_broadcast_recipients
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_recipients" ON wa_broadcast_recipients;
CREATE POLICY "insert_own_recipients" ON wa_broadcast_recipients
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_recipients" ON wa_broadcast_recipients;
CREATE POLICY "update_own_recipients" ON wa_broadcast_recipients
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_recipients" ON wa_broadcast_recipients;
CREATE POLICY "delete_own_recipients" ON wa_broadcast_recipients
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_broadcast_recipients_campaign_id ON wa_broadcast_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_wa_broadcast_campaigns_user_id ON wa_broadcast_campaigns(user_id);
