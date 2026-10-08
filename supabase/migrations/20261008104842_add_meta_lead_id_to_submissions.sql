/*
# Add meta_lead_id column to submissions table

## What changed
- Adds a `meta_lead_id` column (text, nullable) to the `submissions` table.
- This column stores the lead ID assigned by Meta (Facebook/Instagram) when
  a lead is synced from Meta's marketing platform.

## Why
The CRM dashboard and edge functions (meta-conversion-api, meta-marketing-sync)
already reference `meta_lead_id` in inserts, updates, and selects. The column
did not exist in the database, causing a schema cache error and preventing
Meta lead data from being stored or retrieved.

## Security
- No RLS policy changes — the table already has workspace-scoped RLS enabled.
- The new column inherits the table's existing access controls.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'meta_lead_id'
  ) THEN
    ALTER TABLE submissions ADD COLUMN meta_lead_id text;
  END IF;
END $$;
