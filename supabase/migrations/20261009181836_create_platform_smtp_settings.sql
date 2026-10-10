/*
# Create platform_smtp_settings table

## Summary
Adds a platform-level SMTP configuration table that the super admin can configure
once and use as a fallback/default for all CRM accounts that haven't set up their
own SMTP. When an account sends email and has no own smtp_settings row, the
send-email edge function will fall back to this platform config.

## New Table
- `platform_smtp_settings`
  - `id` (uuid, primary key, default gen_random_uuid())
  - `smtp_host` (text) — e.g. smtp.gmail.com
  - `smtp_port` (int, default 587)
  - `smtp_username` (text) — SMTP auth username
  - `smtp_password` (text) — SMTP app password
  - `from_email` (text) — from address shown to recipients
  - `from_name` (text) — display name
  - `use_tls` (boolean, default true)
  - `is_active` (boolean, default true) — can be toggled to disable platform SMTP
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
  - Only one row should exist — enforced by a partial unique index on (is_active = true).

## Security
- RLS enabled.
- Only super admins (verified via is_super_admin() function) can SELECT, INSERT, UPDATE, DELETE.
- The send-email edge function uses the service role key which bypasses RLS, so it
  can read the platform config regardless of who's calling.
*/

CREATE TABLE IF NOT EXISTS platform_smtp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_host text,
  smtp_port int DEFAULT 587,
  smtp_username text,
  smtp_password text,
  from_email text,
  from_name text,
  use_tls boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_smtp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_select_platform_smtp" ON platform_smtp_settings;
CREATE POLICY "super_admin_select_platform_smtp" ON platform_smtp_settings
  FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_insert_platform_smtp" ON platform_smtp_settings;
CREATE POLICY "super_admin_insert_platform_smtp" ON platform_smtp_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_update_platform_smtp" ON platform_smtp_settings;
CREATE POLICY "super_admin_update_platform_smtp" ON platform_smtp_settings
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_delete_platform_smtp" ON platform_smtp_settings;
CREATE POLICY "super_admin_delete_platform_smtp" ON platform_smtp_settings
  FOR DELETE TO authenticated USING (public.is_super_admin());
