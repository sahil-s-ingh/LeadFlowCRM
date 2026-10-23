/*
# Add Telegram VIP channel ID column

1. Modified Tables
- `telegram_settings`: add `tg_vip_channel_id` (text, nullable) — stores the default Telegram channel/group chat ID used for generating one-time VIP invite links from the lead drawer.
2. Security
- No new tables. No RLS changes needed — existing policies on `telegram_settings` already cover SELECT/INSERT/UPDATE for the owner.
*/

ALTER TABLE telegram_settings
  ADD COLUMN IF NOT EXISTS tg_vip_channel_id text;
