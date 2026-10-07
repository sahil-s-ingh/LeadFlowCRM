/*
# Add connected_phone_number to whatsapp_settings

1. Modified Tables
- `whatsapp_settings`: add `connected_phone_number` (text, nullable) — the human-readable WhatsApp Business phone number (e.g. +1234567890) that the user connects, so they can see which number is linked to this chat inbox.
2. Security
- No RLS changes — whatsapp_settings already has owner-scoped policies.
*/

ALTER TABLE whatsapp_settings
  ADD COLUMN IF NOT EXISTS connected_phone_number text;
