/*
# Add inbox visibility toggles to appearance settings

1. Modified Tables
- `appearance_settings`
  - `show_telegram_inbox` (boolean, default true) — controls whether the Telegram Inbox item appears in the CRM sidebar menu
  - `show_whatsapp_inbox` (boolean, default true) — controls whether the WhatsApp Inbox item appears in the CRM sidebar menu

2. Security
- No new tables. Existing RLS policies on `appearance_settings` remain unchanged.

3. Notes
- Both columns default to `true` so existing behavior is preserved (both inboxes visible) until an admin explicitly turns one off.
- The frontend reads these values on CRM load and conditionally renders the corresponding sidebar nav items.
*/

ALTER TABLE appearance_settings
  ADD COLUMN IF NOT EXISTS show_telegram_inbox boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_whatsapp_inbox boolean NOT NULL DEFAULT true;
