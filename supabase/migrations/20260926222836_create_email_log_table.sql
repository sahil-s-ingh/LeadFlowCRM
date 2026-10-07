/*
# Create email_log table for email tracking and analytics

## Purpose
Tracks every email sent from the CRM (single and bulk) with delivery, open, and click metrics.
Enables the Email Analytics dashboard to show: sent, delivered, opened, clicked, bounced, failed.

## New Table: email_log
- id (uuid PK)
- user_id (uuid, FK→auth.users CASCADE, DEFAULT auth.uid()) — owner of the email
- lead_id (uuid, FK→submissions CASCADE, nullable) — which lead the email was sent to
- recipient_email (text, NOT NULL) — the email address sent to
- subject (text, NOT NULL) — email subject line
- body_preview (text) — first 200 chars of the email body for display
- status (text, NOT NULL, DEFAULT 'sent') — sent|delivered|opened|clicked|bounced|failed
- is_bulk (boolean, DEFAULT false) — whether this was part of a bulk send
- message_id (text, nullable) — SMTP message ID from nodemailer
- opened_at (timestamptz, nullable) — first open timestamp
- clicked_at (timestamptz, nullable) — first click timestamp
- clicked_links (jsonb, DEFAULT '[]') — array of URLs that were clicked
- bounce_reason (text, nullable) — bounce/error reason if failed
- sent_at (timestamptz, DEFAULT now()) — when the email was sent
- created_at (timestamptz, DEFAULT now())

## Indexes
- idx_email_log_user_id (user_id)
- idx_email_log_lead_id (lead_id)
- idx_email_log_status (status)
- idx_email_log_sent_at (user_id, sent_at DESC)

## Security (RLS)
- Enable RLS
- Owner-scoped CRUD (auth.uid() = user_id) for SELECT, INSERT, UPDATE, DELETE
*/

CREATE TABLE IF NOT EXISTS email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body_preview text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','opened','clicked','bounced','failed')),
  is_bulk boolean NOT NULL DEFAULT false,
  message_id text,
  opened_at timestamptz,
  clicked_at timestamptz,
  clicked_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  bounce_reason text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_email_log" ON email_log;
CREATE POLICY "select_own_email_log" ON email_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_email_log" ON email_log;
CREATE POLICY "insert_own_email_log" ON email_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_email_log" ON email_log;
CREATE POLICY "update_own_email_log" ON email_log FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_email_log" ON email_log;
CREATE POLICY "delete_own_email_log" ON email_log FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_log_user_id ON email_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_lead_id ON email_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(user_id, sent_at DESC);
