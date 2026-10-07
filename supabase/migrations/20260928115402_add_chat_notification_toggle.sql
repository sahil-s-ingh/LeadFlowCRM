/*
# Add chat notification toggle to follow_up_settings

1. Changes
- Add `enable_chat_notifications` boolean column to `follow_up_settings` table (default false).
- When enabled, the team owner receives an email when someone sends a message in team chat.

2. Security
- No new tables. Column inherits existing RLS policies on follow_up_settings.
*/

ALTER TABLE follow_up_settings
  ADD COLUMN IF NOT EXISTS enable_chat_notifications boolean NOT NULL DEFAULT false;
