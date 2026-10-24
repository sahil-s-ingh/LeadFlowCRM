/*
# Add WhatsApp greeting/away messages and quality health alert settings

## Purpose
Adds per-number configuration for:
1. Automated greeting messages — sent when a customer first messages the business.
2. Away messages — auto-replied outside business hours when no agent is available.
3. Quality health alert settings — email + in-app notification preferences for when a number's quality rating drops.

## New Tables

### `wa_greeting_settings`
- Per whatsapp_settings number, stores greeting + away message configuration.
- `id` uuid PK
- `wa_settings_id` uuid FK to whatsapp_settings(id) ON DELETE CASCADE
- `user_id` uuid FK to auth.users(id) ON DELETE CASCADE — owner
- `greeting_enabled` boolean default false
- `greeting_text` text — message sent to new conversations
- `greeting_trigger_keywords` text[] — keywords that trigger greeting (default hi/hello/hey)
- `away_enabled` boolean default false
- `away_text` text — auto-reply when outside business hours
- `business_hours_enabled` boolean default false
- `business_hours_start` text — e.g. "09:00"
- `business_hours_end` text — e.g. "18:00"
- `business_days` int[] — 0=Sunday..6=Saturday
- `timezone` text default 'UTC'
- `created_at` / `updated_at` timestamptz
- UNIQUE on wa_settings_id (one config per number)

### `wa_quality_alert_settings`
- Per user, stores quality alert notification preferences.
- `id` uuid PK
- `user_id` uuid FK to auth.users(id) ON DELETE CASCADE — unique per user
- `email_alerts_enabled` boolean default true
- `alert_email` text — where to send quality alerts
- `in_app_alerts_enabled` boolean default true
- `alert_on_yellow` boolean default true — notify when quality drops to YELLOW
- `alert_on_red` boolean default true — notify when quality drops to RED
- `alert_on_tier_downgrade` boolean default true — notify when messaging tier decreases
- `last_alerted_quality` text — last quality rating we alerted about (to avoid duplicate alerts)
- `last_alerted_at` timestamptz — when we last sent an alert
- `created_at` / `updated_at` timestamptz

## Security
- RLS on both tables: owner-scoped via auth.uid() = user_id.
- Grants to authenticated for CRUD.
- service_role granted for edge function access.
*/

-- ── 1. wa_greeting_settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_greeting_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_settings_id uuid NOT NULL REFERENCES whatsapp_settings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  greeting_enabled boolean NOT NULL DEFAULT false,
  greeting_text text,
  greeting_trigger_keywords text[] NOT NULL DEFAULT '{hi,hello,hey,start,menu}',
  away_enabled boolean NOT NULL DEFAULT false,
  away_text text,
  business_hours_enabled boolean NOT NULL DEFAULT false,
  business_hours_start text DEFAULT '09:00',
  business_hours_end text DEFAULT '18:00',
  business_days int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wa_settings_id)
);

ALTER TABLE wa_greeting_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON wa_greeting_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON wa_greeting_settings TO service_role;

DROP POLICY IF EXISTS "select_own_wa_greeting_settings" ON wa_greeting_settings;
CREATE POLICY "select_own_wa_greeting_settings"
  ON wa_greeting_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_greeting_settings" ON wa_greeting_settings;
CREATE POLICY "insert_own_wa_greeting_settings"
  ON wa_greeting_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wa_greeting_settings" ON wa_greeting_settings;
CREATE POLICY "update_own_wa_greeting_settings"
  ON wa_greeting_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wa_greeting_settings" ON wa_greeting_settings;
CREATE POLICY "delete_own_wa_greeting_settings"
  ON wa_greeting_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── 2. wa_quality_alert_settings ────────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_quality_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  email_alerts_enabled boolean NOT NULL DEFAULT true,
  alert_email text,
  in_app_alerts_enabled boolean NOT NULL DEFAULT true,
  alert_on_yellow boolean NOT NULL DEFAULT true,
  alert_on_red boolean NOT NULL DEFAULT true,
  alert_on_tier_downgrade boolean NOT NULL DEFAULT true,
  last_alerted_quality text,
  last_alerted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE wa_quality_alert_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON wa_quality_alert_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON wa_quality_alert_settings TO service_role;

DROP POLICY IF EXISTS "select_own_wa_quality_alert_settings" ON wa_quality_alert_settings;
CREATE POLICY "select_own_wa_quality_alert_settings"
  ON wa_quality_alert_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_quality_alert_settings" ON wa_quality_alert_settings;
CREATE POLICY "insert_own_wa_quality_alert_settings"
  ON wa_quality_alert_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wa_quality_alert_settings" ON wa_quality_alert_settings;
CREATE POLICY "update_own_wa_quality_alert_settings"
  ON wa_quality_alert_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wa_quality_alert_settings" ON wa_quality_alert_settings;
CREATE POLICY "delete_own_wa_quality_alert_settings"
  ON wa_quality_alert_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── 3. Add `last_customer_message_at` to wa_conversations ──────────
-- This column tracks the most recent inbound message timestamp so the
-- Conversation Window Tracker can compute 24-hour window expiry without
-- scanning wa_messages each time.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wa_conversations' AND column_name = 'last_customer_message_at'
  ) THEN
    ALTER TABLE wa_conversations ADD COLUMN last_customer_message_at timestamptz;
  END IF;
END $$;

-- Backfill from last_message_at (approximate — last_message_at covers all messages)
UPDATE wa_conversations
SET last_customer_message_at = last_message_at
WHERE last_customer_message_at IS NULL AND last_message_at IS NOT NULL;
