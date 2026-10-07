/*
# Add Purchase Value to Submissions

1. New Columns
- `submissions.purchase_value` (numeric, nullable) — the actual revenue amount
  a lead paid when converted. Distinct from `fund_amount` (the prospect's stated
  investment intent), this captures the real transaction value for Meta
  Conversion API "Purchase" events so ad optimization targets true revenue.
- `meta_conversion_log.purchase_value` (numeric, nullable) — stores the
  purchase value that was sent to Meta for each logged conversion event,
  for audit/debugging.

2. Modified Tables
- `submissions`: adds `purchase_value` column (no data loss — nullable, no
  default, existing rows unaffected).
- `meta_conversion_log`: adds `purchase_value` column alongside existing
  `fund_amount`.

3. Security
- No RLS policy changes. Existing submissions policies already cover the
  new column (column-level privileges are not in use; RLS operates at row
  level).
*/

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS purchase_value numeric;
ALTER TABLE meta_conversion_log ADD COLUMN IF NOT EXISTS purchase_value numeric;
