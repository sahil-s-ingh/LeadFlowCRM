/*
# Create platform WhatsApp config

1. New Table
- `platform_whatsapp_config` — single-row master switch table for super admin
  - cloud_api_enabled (boolean, default true) — master on/off for WhatsApp Cloud API
  - embedded_signup_enabled (boolean, default false) — whether clients see the Quick Connect button
  - coex_enabled (boolean, default false) — whether clients can use App + Cloud API coexistence mode
  - created_at, updated_at timestamps
2. View
- `public_whatsapp_flags` — public view exposing ONLY the three flags (no secrets)
  so the client WhatsApp page can read them without super-admin access.
3. Security
- RLS on platform_whatsapp_config: super-admin-only CRUD via public.is_super_admin().
- The public view is anon+authenticated readable so client pages can query it.
4. Notes
- The Meta App ID / config ID for embedded signup remain in the existing
  wa_embedded_signup_config table. This table only holds the master toggles.
- When cloud_api_enabled is false, clients cannot connect or use WhatsApp at all.
- When embedded_signup_enabled is false, clients only see manual setup.
- When coex_enabled is false, clients cannot toggle coexistence mode on their numbers.
*/

CREATE TABLE IF NOT EXISTS platform_whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cloud_api_enabled boolean NOT NULL DEFAULT true,
  embedded_signup_enabled boolean NOT NULL DEFAULT false,
  coex_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_whatsapp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sa_select_wa_config" ON platform_whatsapp_config;
CREATE POLICY "sa_select_wa_config" ON platform_whatsapp_config
  FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "sa_insert_wa_config" ON platform_whatsapp_config;
CREATE POLICY "sa_insert_wa_config" ON platform_whatsapp_config
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "sa_update_wa_config" ON platform_whatsapp_config;
CREATE POLICY "sa_update_wa_config" ON platform_whatsapp_config
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "sa_delete_wa_config" ON platform_whatsapp_config;
CREATE POLICY "sa_delete_wa_config" ON platform_whatsapp_config
  FOR DELETE TO authenticated USING (public.is_super_admin());

-- Public view: only the enable flags, no secrets
CREATE OR REPLACE VIEW public_whatsapp_flags AS
SELECT
  cloud_api_enabled,
  embedded_signup_enabled,
  coex_enabled
FROM platform_whatsapp_config
LIMIT 1;

GRANT SELECT ON public_whatsapp_flags TO anon, authenticated;