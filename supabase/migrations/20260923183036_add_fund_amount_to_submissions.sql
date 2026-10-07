/*
# Add fund_amount column to submissions

1. Purpose
- Visitors choosing the ALGO trading product must declare their fund amount.
- Minimum fund required for ALGO is $500 (enforced in the frontend form).
- The CRM dashboard will display this column so admin can see each lead's fund amount.

2. New Column on `submissions`
- `fund_amount` (numeric, nullable) — the fund amount the visitor is willing to invest.
- Nullable so existing rows and TradingView Premium submissions are not affected.

3. Security
- The existing INSERT policy (anon, authenticated) already allows inserting any column.
- The existing UPDATE policy (authenticated) already allows updating any column.
- No policy changes needed — the new column inherits the table's existing RLS policies.

4. Notes
- The column is nullable because TradingView Premium submissions don't require a fund amount.
- Frontend validation enforces the $500 minimum for ALGO before the insert is sent.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'fund_amount') THEN
    ALTER TABLE submissions ADD COLUMN fund_amount numeric(12, 2);
  END IF;
END $$;
