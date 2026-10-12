/*
# Create admin audit log table for tracking super admin actions

1. New Tables
- `admin_audit_log`
  - `id` (uuid, primary key)
  - `admin_id` (uuid, references auth.users) — the super admin who performed the action
  - `admin_email` (text) — denormalized for easy display
  - `action_type` (text) — 'account_deleted' or 'plan_assigned' or 'plan_removed'
  - `target_user_id` (uuid, nullable) — the user whose account was affected
  - `target_email` (text, nullable) — denormalized for easy display
  - `details` (jsonb, nullable) — additional context (plan name, billing cycle, reason, etc.)
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `admin_audit_log`.
- Only super admins can read audit log entries.
- Only super admins can insert audit log entries (via edge function with service role key).
*/

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_email text NOT NULL,
  action_type text NOT NULL,
  target_user_id uuid,
  target_email text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_read_audit_log" ON admin_audit_log;
CREATE POLICY "super_admin_read_audit_log" ON admin_audit_log FOR SELECT
  TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "super_admin_insert_audit_log" ON admin_audit_log;
CREATE POLICY "super_admin_insert_audit_log" ON admin_audit_log FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user ON admin_audit_log (target_user_id);
