/*
# Add IB Leads visibility toggle to appearance settings

1. Changes
- Adds `show_ib_leads` boolean column to `appearance_settings` table.
- Defaults to `true` so existing users keep IB Leads visible.
- Backfilled existing rows to `true`.

2. Security
- No RLS changes — this column rides on the existing appearance_settings policies.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appearance_settings' AND column_name = 'show_ib_leads'
  ) THEN
    ALTER TABLE appearance_settings ADD COLUMN show_ib_leads boolean NOT NULL DEFAULT true;
  END IF;
END $$;
