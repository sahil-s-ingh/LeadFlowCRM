/*
# Track WhatsApp messaging usage per phone number

1. New Tables
- `wa_messaging_usage`
  - `id` uuid primary key
  - `wa_settings_id` uuid foreign key to whatsapp_settings(id) ON DELETE CASCADE
  - `phone_number_id` text — the Meta phone number id
  - `customer_phone` text — the recipient phone number (used as the unique-customer key)
  - `window_hour` timestamptz — hour-truncated timestamp used for deduping re-sends within the same hour window
  - `created_at` timestamptz default now()
  - Unique constraint on (wa_settings_id, customer_phone, window_hour) so re-sends to the same customer in the same hour are not double-counted.
  - Index on (wa_settings_id, window_hour) for fast 24h rollups.
2. Purpose
  - Lets the CRM show an approximate count of unique customers messaged in the rolling 24-hour window per WhatsApp number, so users can see how close they are to their Meta messaging limit tier.
3. Security
  - Enable RLS on wa_messaging_usage.
  - Owner-scoped CRUD: each authenticated user can only access usage rows tied to their own whatsapp_settings rows.
*/

CREATE TABLE IF NOT EXISTS wa_messaging_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_settings_id uuid NOT NULL REFERENCES whatsapp_settings(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL,
  customer_phone text NOT NULL,
  window_hour timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  created_at timestamptz DEFAULT now(),
  UNIQUE (wa_settings_id, customer_phone, window_hour)
);

CREATE INDEX IF NOT EXISTS idx_wa_messaging_usage_settings_hour
  ON wa_messaging_usage (wa_settings_id, window_hour);

ALTER TABLE wa_messaging_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_messaging_usage" ON wa_messaging_usage;
CREATE POLICY "select_own_wa_messaging_usage"
  ON wa_messaging_usage FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_settings ws
      WHERE ws.id = wa_messaging_usage.wa_settings_id
      AND ws.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_wa_messaging_usage" ON wa_messaging_usage;
CREATE POLICY "insert_own_wa_messaging_usage"
  ON wa_messaging_usage FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_settings ws
      WHERE ws.id = wa_messaging_usage.wa_settings_id
      AND ws.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_wa_messaging_usage" ON wa_messaging_usage;
CREATE POLICY "update_own_wa_messaging_usage"
  ON wa_messaging_usage FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_settings ws
      WHERE ws.id = wa_messaging_usage.wa_settings_id
      AND ws.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_settings ws
      WHERE ws.id = wa_messaging_usage.wa_settings_id
      AND ws.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_wa_messaging_usage" ON wa_messaging_usage;
CREATE POLICY "delete_own_wa_messaging_usage"
  ON wa_messaging_usage FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_settings ws
      WHERE ws.id = wa_messaging_usage.wa_settings_id
      AND ws.user_id = auth.uid()
    )
  );
