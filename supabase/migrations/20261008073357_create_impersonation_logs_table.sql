/*
# Super Admin Impersonation Feature

## Purpose
Allows the super admin to log into any customer's CRM account directly from
the super admin dashboard, without needing the customer's password. This is
useful for troubleshooting, demos, and support.

## New Tables
- `impersonation_logs`
  - `id` (uuid, primary key)
  - `super_admin_id` (uuid, references auth.users — the admin who impersonated)
  - `super_admin_email` (text — admin's email for audit readability)
  - `target_user_id` (uuid, references auth.users — the customer being impersonated)
  - `target_email` (text — customer's email for audit readability)
  - `started_at` (timestamptz, default now())
  - `ended_at` (timestamptz, nullable — when the admin exited impersonation)
  - RLS: only super admins can read the audit log

## Security
- RLS enabled on impersonation_logs
- Only super admins can SELECT the audit log
- No INSERT/UPDATE/DELETE via API — all mutations go through the edge function
  which uses the service role key
*/
CREATE TABLE IF NOT EXISTS public.impersonation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  super_admin_email text NOT NULL,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_email text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE public.impersonation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admins_read_impersonation_logs" ON public.impersonation_logs;
CREATE POLICY "super_admins_read_impersonation_logs"
ON public.impersonation_logs FOR SELECT
TO authenticated
USING (public.is_super_admin());
