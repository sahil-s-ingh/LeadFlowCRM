/*
# Add Integrations section visibility toggle

## Purpose
Adds a `show_integrations` boolean column to `appearance_settings` so admins can
show/hide the "Integrations" nav item via the Section Visibility settings tab,
matching the pattern used for Leads, Brokers, Inbox, Broadcasts, Analytics,
Lead Tracker, Templates, Follow-Ups, Automations, and Pipeline.

## Changes
- `appearance_settings.show_integrations` (boolean, default true, nullable)

## Security
No new tables. No RLS policy changes — existing appearance_settings policies
already allow the authenticated owner to read/update their own row.
*/

DO $$
BEGIN
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_integrations boolean DEFAULT true;
END $$;
