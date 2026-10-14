/*
# Platform Meta Ads Config + OAuth Fields

## Purpose
Stores the platform-level Meta App credentials (configured by Super Admin) so every customer
can use the "Connect with Facebook" OAuth flow without needing their own Meta App.
Also adds OAuth-related fields to the existing meta_ads_settings table.

## Changes

### 1. New table: `platform_meta_ads_config`
Single-row table holding the Meta App ID and App Secret configured by the Super Admin.
RLS gated to `is_super_admin()` — only super admins can read/write.
Edge functions read it with the service role key (bypasses RLS).

### 2. Alter `meta_ads_settings`
Add columns for the OAuth flow:
- `fb_user_id` (text) — Facebook user ID of the connected account
- `fb_user_name` (text) — Facebook user name for display
- `token_expires_at` (timestamptz) — when the long-lived token expires
- `connected_via` (text) — 'oauth' or 'manual' (default 'manual' for backwards compat)
*/

-- ============================================================
-- 1. platform_meta_ads_config
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_meta_ads_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_app_id text NOT NULL,
  app_secret text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_meta_ads_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_select_platform_meta_ads" ON platform_meta_ads_config;
CREATE POLICY "super_admin_select_platform_meta_ads" ON platform_meta_ads_config
  FOR SELECT TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_insert_platform_meta_ads" ON platform_meta_ads_config;
CREATE POLICY "super_admin_insert_platform_meta_ads" ON platform_meta_ads_config
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_update_platform_meta_ads" ON platform_meta_ads_config;
CREATE POLICY "super_admin_update_platform_meta_ads" ON platform_meta_ads_config
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_delete_platform_meta_ads" ON platform_meta_ads_config;
CREATE POLICY "super_admin_delete_platform_meta_ads" ON platform_meta_ads_config
  FOR DELETE TO authenticated USING (public.is_super_admin());

-- ============================================================
-- 2. Alter meta_ads_settings — add OAuth columns
-- ============================================================
ALTER TABLE meta_ads_settings
  ADD COLUMN IF NOT EXISTS fb_user_id text,
  ADD COLUMN IF NOT EXISTS fb_user_name text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS connected_via text NOT NULL DEFAULT 'manual';