/*
# Add Click-to-WhatsApp ad fields to meta_ads_settings

1. Purpose
- Stores the Facebook Page ID and WhatsApp phone number needed to create
  click-to-WhatsApp ads via the Marketing API.
- Also adds columns to meta_ad_campaigns to track whether a campaign is a
  click-to-WhatsApp campaign and to store the WhatsApp greeting message.

2. Changes to existing tables (additive only, no data loss)

### meta_ads_settings
- `page_id` (text) — Facebook Page ID used for ad creative object_story_spec
- `whatsapp_phone_number` (text) — WhatsApp Business number for promoted_object
- `page_name` (text) — display name of the connected Facebook Page

### meta_ad_campaigns
- `is_click_to_whatsapp` (boolean, default false) — marks C2W campaigns
- `whatsapp_greeting` (text) — greeting message shown in WhatsApp chat

3. Security
- No new tables, no policy changes needed.
- Existing RLS policies already cover the new columns since they are on
  existing owner-scoped tables.
*/

ALTER TABLE meta_ads_settings
  ADD COLUMN IF NOT EXISTS page_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number text,
  ADD COLUMN IF NOT EXISTS page_name text;

ALTER TABLE meta_ad_campaigns
  ADD COLUMN IF NOT EXISTS is_click_to_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_greeting text;