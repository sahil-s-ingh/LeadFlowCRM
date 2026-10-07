/*
# Allow public read of Telegram community link

1. Purpose
- The landing page (no login) needs to read the `telegram_link` value from `telegram_settings` to show the "Join Telegram Community" button after form submission.
- The rest of the table (bot_token, bot_username, welcome_message) must remain private to the authenticated owner.

2. Security changes
- Revoke the default `anon` SELECT privilege on ALL columns of `telegram_settings`.
- Grant `anon` SELECT on ONLY the `telegram_link` column.
- Add an `anon`-readable SELECT policy so the public can read the link row.
- The existing `authenticated` policies remain unchanged; authenticated owners keep full access to all columns.
*/

REVOKE SELECT ON telegram_settings FROM anon;
GRANT SELECT (telegram_link) ON telegram_settings TO anon;

DROP POLICY IF EXISTS "anon_read_telegram_link" ON telegram_settings;
CREATE POLICY "anon_read_telegram_link" ON telegram_settings FOR SELECT
  TO anon USING (true);
