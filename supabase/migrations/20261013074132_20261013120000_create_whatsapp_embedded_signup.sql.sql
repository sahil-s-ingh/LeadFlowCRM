/*
# WhatsApp Embedded Signup Configuration

## What this does
1. Creates `wa_embedded_signup_config` table for Super Admin to configure the Meta App ID,
   configuration ID, and toggle embedded signup on/off for all clients.
2. Adds `onboarding_method` column to `whatsapp_settings` to track whether a number was
   connected via embedded signup or manual entry.
3. Adds `waba_id` is already present — no change needed there.

## New Tables
- `wa_embedded_signup_config` (single row, super-admin managed)
  - `id` uuid PK
  - `meta_app_id` text — Meta App ID for the WhatsApp Business app
  - `config_id` text — Configuration ID for the embedded signup flow
  - `enabled` boolean — toggle embedded signup globally
  - `created_at` / `updated_at` timestamps

## Modified Tables
- `whatsapp_settings` — adds `onboarding_method` text column (values: 'embedded' | 'manual', default 'manual')

## Security
- `wa_embedded_signup_config`: only super admins can read/write (RLS + is_super_admin check)
- `whatsapp_settings`: existing owner-scoped RLS still applies; new column inherits existing policies
*/

-- 1. Create embedded signup config table
CREATE TABLE IF NOT EXISTS wa_embedded_signup_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_app_id text,
  config_id text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wa_embedded_signup_config ENABLE ROW LEVEL SECURITY;

-- Only super admins can read
DROP POLICY IF EXISTS "sa_select_wa_embedded_config" ON wa_embedded_signup_config;
CREATE POLICY "sa_select_wa_embedded_config"
  ON wa_embedded_signup_config FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Only super admins can insert
DROP POLICY IF EXISTS "sa_insert_wa_embedded_config" ON wa_embedded_signup_config;
CREATE POLICY "sa_insert_wa_embedded_config"
  ON wa_embedded_signup_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

-- Only super admins can update
DROP POLICY IF EXISTS "sa_update_wa_embedded_config" ON wa_embedded_signup_config;
CREATE POLICY "sa_update_wa_embedded_config"
  ON wa_embedded_signup_config FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Only super admins can delete
DROP POLICY IF EXISTS "sa_delete_wa_embedded_config" ON wa_embedded_signup_config;
CREATE POLICY "sa_delete_wa_embedded_config"
  ON wa_embedded_signup_config FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- 2. Add onboarding_method column to whatsapp_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'onboarding_method'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN onboarding_method text DEFAULT 'manual';
  END IF;
END $$;
