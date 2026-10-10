/*
# Add lead_source column to submissions

## Summary
Adds a `lead_source` text column to the `submissions` table so we can track where
each lead came from (Landing Page, Meta Ads, Direct Link, Bulk Upload, Manual Entry,
Webhook, etc.). Existing leads are backfilled based on whether they have a
`meta_lead_id` (set = "Meta Ads", null = "Landing Page").

## Changes
1. New column:
   - `lead_source` (text, nullable) on `submissions` — records the acquisition channel.
2. Backfill:
   - Existing rows: if `meta_lead_id` is not null, set to 'Meta Ads'; otherwise 'Landing Page'.
3. Security:
   - No RLS policy changes — the column inherits the existing per-row policies on `submissions`.

## Notes
- The column is nullable so existing code that doesn't set it won't break.
- New leads created via the landing form will get 'Landing Page' by default.
- Leads created via Meta Ads (with a meta_lead_id) get 'Meta Ads'.
- Leads created manually via Add Lead get 'Manual Entry'.
- Leads created via bulk upload get 'Bulk Upload'.
- Leads created via webhook/inbound API get 'Webhook'.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'lead_source'
  ) THEN
    ALTER TABLE submissions ADD COLUMN lead_source text;
  END IF;
END $$;

UPDATE submissions
SET lead_source = CASE
  WHEN meta_lead_id IS NOT NULL THEN 'Meta Ads'
  ELSE 'Landing Page'
END
WHERE lead_source IS NULL;
