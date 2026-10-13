/*
# Create smtp_servers table for multi-SMTP support

1. New Tables
- `smtp_servers`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, default auth.uid(), references auth.users ON DELETE CASCADE)
  - `label` (text) — friendly name e.g. "Gmail", "SendGrid"
  - `smtp_host` (text, not null) — e.g. smtp.gmail.com
  - `smtp_port` (int, default 587)
  - `smtp_username` (text, not null) — SMTP auth username
  - `smtp_password` (text, not null) — SMTP app password
  - `from_email` (text) — from address shown to recipients
  - `from_name` (text) — display name
  - `use_tls` (boolean, default true)
  - `priority` (int, default 0) — lower = tried first
  - `is_active` (boolean, default true) — can be disabled without deleting
  - `daily_limit` (int, nullable) — max emails per day from this server
  - `sent_today` (int, default 0) — counter for today
  - `sent_date` (date, nullable) — date for the sent_today counter
  - `last_error` (text, nullable) — last send error message
  - `last_error_at` (timestamptz, nullable) — when the last error occurred
  - `total_sent` (int, default 0) — lifetime sent count
  - `total_failed` (int, default 0) — lifetime failed count
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Backfill
- For each existing row in `smtp_settings`, insert a corresponding row into `smtp_servers` with priority 0, is_active true, label 'Primary'.

3. Security
- RLS enabled, owner-scoped CRUD via auth.uid() = user_id.
*/

CREATE TABLE IF NOT EXISTS smtp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Primary',
  smtp_host text NOT NULL,
  smtp_port int DEFAULT 587,
  smtp_username text NOT NULL,
  smtp_password text NOT NULL,
  from_email text,
  from_name text,
  use_tls boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  daily_limit int,
  sent_today int NOT NULL DEFAULT 0,
  sent_date date,
  last_error text,
  last_error_at timestamptz,
  total_sent int NOT NULL DEFAULT 0,
  total_failed int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE smtp_servers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_smtp_servers" ON smtp_servers;
CREATE POLICY "select_own_smtp_servers" ON smtp_servers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_smtp_servers" ON smtp_servers;
CREATE POLICY "insert_own_smtp_servers" ON smtp_servers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_smtp_servers" ON smtp_servers;
CREATE POLICY "update_own_smtp_servers" ON smtp_servers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_smtp_servers" ON smtp_servers;
CREATE POLICY "delete_own_smtp_servers" ON smtp_servers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_smtp_servers_user_active ON smtp_servers(user_id, is_active, priority);

-- Backfill from existing smtp_settings (only if smtp_servers is empty for that user)
INSERT INTO smtp_servers (user_id, label, smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name, use_tls, priority, is_active)
SELECT s.user_id, 'Primary', s.smtp_host, s.smtp_port, s.smtp_username, s.smtp_password, s.from_email, s.from_name, s.use_tls, 0, true
FROM smtp_settings s
WHERE s.smtp_host IS NOT NULL AND s.smtp_host != ''
  AND NOT EXISTS (SELECT 1 FROM smtp_servers ss WHERE ss.user_id = s.user_id);
