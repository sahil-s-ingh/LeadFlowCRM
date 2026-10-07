/*
# Add setup_cost column to appearance_settings

1. Modified Tables
- `appearance_settings`
  - New column: `setup_cost` (numeric, default 10) — the per-client setup cost charged when a lead is converted.
2. Security
- No RLS policy changes. The existing appearance_settings policies already cover read/write for authenticated users.
3. Notes
- The column is nullable-safe with a default of 10 so existing rows and new inserts work without changes.
- Frontend reads this value and multiplies by the number of converted leads to show the total setup cost.
*/

ALTER TABLE appearance_settings
ADD COLUMN IF NOT EXISTS setup_cost numeric DEFAULT 10;
