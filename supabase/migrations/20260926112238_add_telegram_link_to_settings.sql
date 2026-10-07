/*
# Add Telegram Community Link to Settings

1. Changes
- Add `telegram_link` column (text, nullable) to `telegram_settings` table.
- This stores the Telegram community/group invite link that admins configure.
- The link is shown on the landing page after a visitor submits the form, as a "Join Telegram Community" button.
2. Security
- No new tables. Existing RLS policies on `telegram_settings` already cover the new column.
- The column is owner-scoped (same user_id-based policies as the rest of the table).
*/

ALTER TABLE telegram_settings
  ADD COLUMN IF NOT EXISTS telegram_link text;
