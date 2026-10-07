/*
# Add Meta App ID to WhatsApp settings

1. Changes
- Adds `meta_app_id` (text) column to the `whatsapp_settings` table.
- This stores the Meta App ID needed for the Resumable Upload API, which is required
  to upload a profile picture binary and get a file handle for the WhatsApp Business profile.
2. Security
- No RLS policy changes. The existing whatsapp_settings policies already govern access.
*/

ALTER TABLE whatsapp_settings
  ADD COLUMN IF NOT EXISTS meta_app_id text;
