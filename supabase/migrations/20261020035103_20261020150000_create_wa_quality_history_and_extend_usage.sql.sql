/*
# Track WhatsApp quality rating history + 7-day message volume + conversation windows

## Purpose
Enhances the Phone Number Status section with:
1. Quality rating history (GREEN/YELLOW/RED) over time per number, so users can spot downward trends before Meta downgrades their tier.
2. Daily message volume per number (last 7 days) for a bar chart.
3. Conversation window tracking — how many customer conversations are still within the 24-hour reply window vs expired.
4. Cost estimation support — tracks business-initiated vs customer-initiated conversations per day.

## New Tables

### `wa_quality_history`
- `id` uuid PK
- `wa_settings_id` uuid FK to whatsapp_settings(id) ON DELETE CASCADE
- `quality_rating` text — GREEN / YELLOW / RED
- `messaging_limit_tier` text — the tier at the time of the check
- `checked_at` timestamptz default now()
- One row per status check per number. The edge function logs a new row each time status_all is called and the quality or tier differs from the most recent entry (or if no prior entry exists).
- Index on (wa_settings_id, checked_at DESC) for fast history retrieval.

## Existing Table Extensions

### `wa_messaging_usage`
- Added `message_direction` text — 'business_initiated' or 'customer_initiated' (nullable for backward compat with existing rows).
- Added `conversation_id` uuid nullable FK to wa_conversations(id) ON DELETE SET NULL — links the usage row to the conversation it was sent in, so we can determine which conversations are still within the 24h window.

## Security
- RLS on wa_quality_history: owner-scoped via whatsapp_settings ownership (same pattern as wa_messaging_usage).
- No RLS changes needed for wa_messaging_usage column additions.
*/

-- ── 1. New table: wa_quality_history ────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_quality_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_settings_id uuid NOT NULL REFERENCES whatsapp_settings(id) ON DELETE CASCADE,
  quality_rating text NOT NULL,
  messaging_limit_tier text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_quality_history_settings_time
  ON wa_quality_history (wa_settings_id, checked_at DESC);

ALTER TABLE wa_quality_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_quality_history" ON wa_quality_history;
CREATE POLICY "select_own_wa_quality_history"
  ON wa_quality_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_settings ws
      WHERE ws.id = wa_quality_history.wa_settings_id
      AND ws.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_wa_quality_history" ON wa_quality_history;
CREATE POLICY "insert_own_wa_quality_history"
  ON wa_quality_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_settings ws
      WHERE ws.id = wa_quality_history.wa_settings_id
      AND ws.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_wa_quality_history" ON wa_quality_history;
CREATE POLICY "delete_own_wa_quality_history"
  ON wa_quality_history FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_settings ws
      WHERE ws.id = wa_quality_history.wa_settings_id
      AND ws.user_id = auth.uid()
    )
  );

-- ── 2. Extend wa_messaging_usage with direction + conversation link ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wa_messaging_usage' AND column_name = 'message_direction'
  ) THEN
    ALTER TABLE wa_messaging_usage ADD COLUMN message_direction text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wa_messaging_usage' AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE wa_messaging_usage ADD COLUMN conversation_id uuid REFERENCES wa_conversations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wa_messaging_usage_settings_day
  ON wa_messaging_usage (wa_settings_id, window_hour);
