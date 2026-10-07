/*
# Support combined service selection for qualified trading leads

1. Modified Tables
- `submissions.trading_product` — accepts the existing `algo` and `tradingview_premium` values plus `both`, so CRM staff can record a lead who wants both services.
- `submissions.custom_data` — already stores additional questionnaire answers and remains available for the new qualification fields.

2. Security
- No new table or policy is introduced.
- Existing row-level security and access rules on `submissions` remain unchanged.

3. Important Notes
- This change preserves all existing lead records and values.
- Existing reports that recognize the two original values continue to work; the combined choice is stored explicitly as `both` for new records.
*/

ALTER TABLE submissions
  DROP CONSTRAINT IF EXISTS submissions_trading_product_check;

ALTER TABLE submissions
  ADD CONSTRAINT submissions_trading_product_check
  CHECK (trading_product IN ('algo', 'tradingview_premium', 'both'));