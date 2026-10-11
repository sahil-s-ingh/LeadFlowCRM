/*
# Add Account Type and Partner Code to Submissions

1. Purpose
   This migration adds two new columns to the `submissions` table to track
   whether a client opened a brand-new trading account or already had one,
   and what IB partner/referral code they used when registering.

2. New Columns on `submissions`
   - `account_type` (text, nullable) — stores one of:
     * 'new_account'     — client created a brand-new trading account
     * 'existing_account' — client already had an account
     * NULL — not yet recorded
   - `partner_code` (text, nullable) — the IB partner/referral code the
     client used when registering with the broker. Free-text field.

3. Security
   No new tables. No RLS policy changes needed — the existing CRUD policies
   on `submissions` already cover these columns since they are on the same table.

4. Notes
   - Both columns are nullable so existing rows are not affected.
   - No destructive changes (no drops, no type changes, no renames).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE submissions ADD COLUMN account_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'partner_code'
  ) THEN
    ALTER TABLE submissions ADD COLUMN partner_code text;
  END IF;
END $$;