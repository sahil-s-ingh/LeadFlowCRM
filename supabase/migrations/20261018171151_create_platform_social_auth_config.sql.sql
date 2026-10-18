/*
# Create platform social auth config

1. New Tables
- `platform_social_auth_config` — single-row config table for super admin
  - google_enabled (boolean, default false)
  - facebook_enabled (boolean, default false)
  - google_client_id (text, nullable — reference only; actual OAuth is configured in Supabase Auth settings)
  - google_client_secret (text, nullable — reference only)
  - facebook_client_id (text, nullable — reference only)
  - facebook_client_secret (text, nullable — reference only)
  - is_active (boolean, default true)
  - created_at, updated_at timestamps
2. Views
- `public_social_auth_flags` — public view exposing ONLY google_enabled and facebook_enabled
  so the pre-login page can read which buttons to show WITHOUT exposing client secrets.
3. Security
- RLS enabled on platform_social_auth_config. Super-admin-only CRUD via public.is_super_admin().
- The public view is anon-readable so the login page can query it before a session exists.
4. Notes
- Client IDs/secrets stored here are a reference record. The actual OAuth handshake is handled
  by Supabase Auth, so the same credentials MUST also be entered in Supabase Dashboard ->
  Authentication -> Providers. A note in the admin UI reminds the operator of this.
*/

CREATE TABLE IF NOT EXISTS platform_social_auth_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_enabled boolean NOT NULL DEFAULT false,
  facebook_enabled boolean NOT NULL DEFAULT false,
  google_client_id text,
  google_client_secret text,
  facebook_client_id text,
  facebook_client_secret text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_social_auth_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_select_social_auth" ON platform_social_auth_config;
CREATE POLICY "super_admin_select_social_auth" ON platform_social_auth_config
  FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_insert_social_auth" ON platform_social_auth_config;
CREATE POLICY "super_admin_insert_social_auth" ON platform_social_auth_config
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_update_social_auth" ON platform_social_auth_config;
CREATE POLICY "super_admin_update_social_auth" ON platform_social_auth_config
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_delete_social_auth" ON platform_social_auth_config;
CREATE POLICY "super_admin_delete_social_auth" ON platform_social_auth_config
  FOR DELETE TO authenticated USING (public.is_super_admin());

-- Public view: only the enable flags, no secrets
CREATE OR REPLACE VIEW public_social_auth_flags AS
SELECT
  google_enabled,
  facebook_enabled
FROM platform_social_auth_config
WHERE is_active = true
LIMIT 1;

GRANT SELECT ON public_social_auth_flags TO anon, authenticated;