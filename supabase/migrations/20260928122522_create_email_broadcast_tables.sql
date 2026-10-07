/*
# Create Email Broadcast Campaign tables

1. New Tables
- `email_broadcast_campaigns`: Stores email broadcast campaigns (subject + body + recipient list + status)
  - id (uuid PK)
  - user_id (uuid, owner, defaults to auth.uid())
  - subject (text) — email subject line
  - body (text) — email body (plain text or HTML)
  - html_body (text, nullable) — optional HTML version
  - status (text) — draft | sending | completed | failed
  - total_recipients (int, default 0)
  - sent_count (int, default 0)
  - failed_count (int, default 0)
  - created_at, updated_at (timestamptz)

- `email_broadcast_recipients`: Individual recipients within a campaign
  - id (uuid PK)
  - campaign_id (uuid FK → email_broadcast_campaigns ON DELETE CASCADE)
  - user_id (uuid, owner, defaults to auth.uid())
  - lead_id (uuid, nullable — link to CRM lead if exists)
  - email (text) — recipient email address
  - status (text) — pending | sent | failed
  - error_message (text, nullable)
  - email_log_id (uuid, nullable — link to email_log for tracking)
  - sent_at (timestamptz, nullable)
  - created_at (timestamptz)

2. Security
- RLS enabled on both tables.
- Owner-scoped CRUD: authenticated users can only access their own campaigns/recipients.
*/

CREATE TABLE IF NOT EXISTS email_broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  html_body text,
  status text NOT NULL DEFAULT 'draft',
  total_recipients int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_broadcast_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_email_broadcasts" ON email_broadcast_campaigns;
CREATE POLICY "select_own_email_broadcasts" ON email_broadcast_campaigns
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_email_broadcasts" ON email_broadcast_campaigns;
CREATE POLICY "insert_own_email_broadcasts" ON email_broadcast_campaigns
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_email_broadcasts" ON email_broadcast_campaigns;
CREATE POLICY "update_own_email_broadcasts" ON email_broadcast_campaigns
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_email_broadcasts" ON email_broadcast_campaigns;
CREATE POLICY "delete_own_email_broadcasts" ON email_broadcast_campaigns
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS email_broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES email_broadcast_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  email_log_id uuid,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_broadcast_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_email_broadcast_recipients" ON email_broadcast_recipients;
CREATE POLICY "select_own_email_broadcast_recipients" ON email_broadcast_recipients
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_email_broadcast_recipients" ON email_broadcast_recipients;
CREATE POLICY "insert_own_email_broadcast_recipients" ON email_broadcast_recipients
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_email_broadcast_recipients" ON email_broadcast_recipients;
CREATE POLICY "update_own_email_broadcast_recipients" ON email_broadcast_recipients
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_email_broadcast_recipients" ON email_broadcast_recipients;
CREATE POLICY "delete_own_email_broadcast_recipients" ON email_broadcast_recipients
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_broadcast_recipients_campaign_id ON email_broadcast_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_broadcast_campaigns_user_id ON email_broadcast_campaigns(user_id);