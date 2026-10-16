/*
# Add lead_event_source to meta_conversion_settings

## Purpose
Meta's CRM Lead Status Integration requires `custom_data.lead_event_source` to be
the name of the CRM (e.g. "HubSpot", "Salesforce", or your custom CRM name).
This column lets the admin configure that name.

## Changes
- Added `lead_event_source` column (text, default 'SahilExchange CRM')

## Security
- No RLS changes. Existing owner-scoped policies cover the new column.
*/

ALTER TABLE meta_conversion_settings
  ADD COLUMN IF NOT EXISTS lead_event_source text DEFAULT 'SahilExchange CRM';
