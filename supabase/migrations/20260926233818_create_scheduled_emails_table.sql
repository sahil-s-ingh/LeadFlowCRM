/*
# Create scheduled_emails table

## Purpose
Stores bulk email campaigns scheduled to send at a future date/time.
The process-scheduled-emails edge function (cron-triggered every 1 minute) picks up
rows with status='pending' whose scheduled_at <= now() and sends them in batches
with rate-limiting to respect SMTP provider limits.

## New Table: scheduled_emails
- id (uuid PK)
- user_id (uuid, FK→auth.users CASCADE) — owner
- subject (text, NOT NULL) — email subject (with placeholders)
- body (text, NOT NULL) — email body (with placeholders)
- from_name (text) — sender display name
- recipient_emails (jsonb, NOT NULL) — array of {id, email, full_name} objects
- scheduled_at (timestamptz, NOT NULL) — when to start sending
- status (text, NOT NULL DEFAULT 'pending') — pending|sending|completed|cancelled|partially_failed
- sent_count (int, DEFAULT 0)
- failed_count (int, DEFAULT 0)
- failed_recipients (jsonb, DEFAULT '[]') — array of failed {id, email, full_name, error}
- attachment_meta (jsonb, DEFAULT '[]') — array of {filename, content_base64, contentType}
- created_at (timestamptz, DEFAULT now())
- updated_at (timestamptz, DEFAULT now())

## RLS
- Owner-scoped CRUD (auth.uid() = user_id)
*/

CREATE TABLE IF NOT EXISTS scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  from_name text,
  recipient_emails jsonb NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','completed','cancelled','partially_failed')),
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  failed_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachment_meta jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_scheduled_emails" ON scheduled_emails;
CREATE POLICY "select_own_scheduled_emails" ON scheduled_emails FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_scheduled_emails" ON scheduled_emails;
CREATE POLICY "insert_own_scheduled_emails" ON scheduled_emails FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_scheduled_emails" ON scheduled_emails;
CREATE POLICY "update_own_scheduled_emails" ON scheduled_emails FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_scheduled_emails" ON scheduled_emails;
CREATE POLICY "delete_own_scheduled_emails" ON scheduled_emails FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_user ON scheduled_emails(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status, scheduled_at);

-- Schedule the processor to run every minute
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'process-scheduled-emails',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := '${SUPABASE_URL}' || '/functions/v1/process-scheduled-emails',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
