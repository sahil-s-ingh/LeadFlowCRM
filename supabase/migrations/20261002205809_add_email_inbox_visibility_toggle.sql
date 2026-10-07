/*
# Add email inbox visibility toggle to appearance settings

1. Modified Tables
- `appearance_settings`
  - `show_email_inbox` (boolean, default true) — controls whether the Email Inbox tab appears in the Inbox Hub

2. Security
- No new tables. Existing RLS policies on `appearance_settings` remain unchanged.

3. Notes
- Column defaults to `true` so existing behavior is preserved (email inbox visible) until an admin explicitly turns it off.
- The frontend reads this value on CRM load and conditionally renders the email inbox tab.
*/

ALTER TABLE appearance_settings
  ADD COLUMN IF NOT EXISTS show_email_inbox boolean NOT NULL DEFAULT true;