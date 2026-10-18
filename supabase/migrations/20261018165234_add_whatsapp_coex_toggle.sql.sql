/*
# Add WhatsApp Coexistence (App Sync) toggle

1. Changes
- Adds `coex_enabled` boolean column to `whatsapp_settings` table, defaulting to false.
- When enabled, this number uses WhatsApp App + Cloud API coexistence mode (Meta's official CoEx feature).
2. Security
- No RLS changes — existing policies on whatsapp_settings already cover the new column.
3. Notes
- Column is nullable-safe with IF NOT EXISTS guard.
- Default is false so existing numbers remain API-only until explicitly toggled.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_settings' AND column_name = 'coex_enabled'
  ) THEN
    ALTER TABLE whatsapp_settings ADD COLUMN coex_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;