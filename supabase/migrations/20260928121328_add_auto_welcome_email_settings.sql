/*
# Add auto welcome email settings to follow_up_settings

1. Modified Tables
- `follow_up_settings`
  - `enable_auto_welcome_email` (boolean, default false) — toggle for auto welcome email on new lead
  - `auto_welcome_email_subject` (text) — custom subject line for the welcome email
  - `auto_welcome_email_body` (text) — custom body text for the welcome email

2. Security
- No new tables. Existing RLS policies on follow_up_settings remain unchanged.
*/

ALTER TABLE follow_up_settings
  ADD COLUMN IF NOT EXISTS enable_auto_welcome_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_welcome_email_subject text,
  ADD COLUMN IF NOT EXISTS auto_welcome_email_body text;
