/*
# Create Twilio settings and call logs tables

1. New Tables
- `twilio_settings`: Stores Twilio Account SID, Auth Token, and the purchased virtual phone number (Twilio number) used as caller ID. One row per account (user_id scoped).
  - `id` (uuid, primary key)
  - `user_id` (uuid, owner, defaults to auth.uid())
  - `account_sid` (text, Twilio Account SID)
  - `auth_token` (text, Twilio Auth Token — stored encrypted at rest by Supabase, used server-side only via edge function)
  - `twilio_number` (text, the purchased Twilio phone number in E.164 format, e.g. +12345678901)
  - `created_at`, `updated_at` (timestamps)
- `call_logs`: Records each outgoing call made through the virtual number dialer.
  - `id` (uuid, primary key)
  - `user_id` (uuid, owner, defaults to auth.uid())
  - `lead_id` (uuid, nullable, FK to submissions if the call was to a lead)
  - `phone_number` (text, the number dialed)
  - `lead_name` (text, nullable, denormalized for display)
  - `status` (text: 'initiated', 'ringing', 'completed', 'failed', 'no-answer', 'busy')
  - `duration` (integer, seconds, default 0)
  - `twilio_call_sid` (text, nullable, Twilio's call identifier)
  - `direction` (text, default 'outbound')
  - `created_at` (timestamp)

2. Security
- Enable RLS on both tables.
- twilio_settings: owner-scoped CRUD (authenticated, auth.uid() = user_id).
- call_logs: owner-scoped CRUD (authenticated, auth.uid() = user_id).
*/

CREATE TABLE IF NOT EXISTS twilio_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_sid text NOT NULL DEFAULT '',
  auth_token text NOT NULL DEFAULT '',
  twilio_number text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE twilio_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_twilio_settings" ON twilio_settings;
CREATE POLICY "select_own_twilio_settings" ON twilio_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_twilio_settings" ON twilio_settings;
CREATE POLICY "insert_own_twilio_settings" ON twilio_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_twilio_settings" ON twilio_settings;
CREATE POLICY "update_own_twilio_settings" ON twilio_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_twilio_settings" ON twilio_settings;
CREATE POLICY "delete_own_twilio_settings" ON twilio_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  phone_number text NOT NULL DEFAULT '',
  lead_name text,
  status text NOT NULL DEFAULT 'initiated',
  duration integer NOT NULL DEFAULT 0,
  twilio_call_sid text,
  direction text NOT NULL DEFAULT 'outbound',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_call_logs" ON call_logs;
CREATE POLICY "select_own_call_logs" ON call_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_call_logs" ON call_logs;
CREATE POLICY "insert_own_call_logs" ON call_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_call_logs" ON call_logs;
CREATE POLICY "update_own_call_logs" ON call_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_call_logs" ON call_logs;
CREATE POLICY "delete_own_call_logs" ON call_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);
