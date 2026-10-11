/*
# Add Section Visibility Toggles to Appearance Settings

## Purpose
Allows the CRM admin to show/hide individual pages from the sidebar navigation
via a dedicated "Section Visibility" settings tab. Toggles are per-user (stored
in appearance_settings) and persist across devices.

## New Columns on `appearance_settings`
All columns are boolean, default true (visible), nullable.

- `show_leads` — Controls visibility of the Leads nav item
- `show_brokers` — Controls visibility of the Broker Tracker nav item
- `show_inbox` — Controls visibility of the Shared Inbox nav item
- `show_broadcasts` — Controls visibility of the Broadcasts nav item
- `show_analytics` — Controls visibility of the Analytics nav item
- `show_lead_tracker` — Controls visibility of the Lead Tracker nav item
- `show_templates` — Controls visibility of the Templates nav item
- `show_followups` — Controls visibility of the Follow-Ups nav item
- `show_automations` — Controls visibility of the Automations nav item
- `show_pipeline` — Controls visibility of the Pipeline funnel in sidebar

Dashboard and Settings are always visible and cannot be toggled off.
The existing `show_ib_leads` column is reused (already exists).

## Security
No new tables. No RLS policy changes. Existing appearance_settings policies
already allow the authenticated owner to read/update their own row.
*/

DO $$
BEGIN
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_leads boolean DEFAULT true;
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_brokers boolean DEFAULT true;
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_inbox boolean DEFAULT true;
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_broadcasts boolean DEFAULT true;
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_analytics boolean DEFAULT true;
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_lead_tracker boolean DEFAULT true;
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_templates boolean DEFAULT true;
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_followups boolean DEFAULT true;
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_automations boolean DEFAULT true;
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_pipeline boolean DEFAULT true;
END $$;
