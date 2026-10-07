/*
# Create smtp_settings table

1. New Tables
- `smtp_settings`
  - `id` (uuid, primary key, default gen_random_uuid())
  - `user_id` (uuid, not null, default auth.uid(), references auth.users ON DELETE CASCADE)
  - `smtp_host` (text) — e.g. smtp.gmail.com
  - `smtp_port` (int, default 587)
  - `smtp_username` (text) — SMTP auth username
  - `smtp_password` (text) — SMTP app password
  - `from_email` (text) — from address shown to recipients
  - `from_name` (text) — display name
  - `use_tls` (boolean, default true)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- RLS enabled, owner-scoped CRUD via auth.uid() = user_id.
- Unique constraint on user_id (one config per admin).
*/

CREATE TABLE IF NOT EXISTS smtp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  smtp_host text,
  smtp_port int DEFAULT 587,
  smtp_username text,
  smtp_password text,
  from_email text,
  from_name text,
  use_tls boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE smtp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_smtp" ON smtp_settings;
CREATE POLICY "select_own_smtp" ON smtp_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_smtp" ON smtp_settings;
CREATE POLICY "insert_own_smtp" ON smtp_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_smtp" ON smtp_settings;
CREATE POLICY "update_own_smtp" ON smtp_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_smtp" ON smtp_settings;
CREATE POLICY "delete_own_smtp" ON smtp_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);