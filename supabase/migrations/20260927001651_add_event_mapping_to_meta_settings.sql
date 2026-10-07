/*
# Add per-stage event mapping columns to meta_conversion_settings

## Purpose
Allow the owner to manually map each CRM lead stage to a specific Meta Conversion API event,
instead of using a hardcoded mapping.

## Changes to existing table: meta_conversion_settings
- event_new (text, default 'Lead')
- event_called_no_response (text, default 'Contact')
- event_called_responded (text, default 'Contact')
- event_interested (text, default 'Contact')
- event_not_interested (text, default 'Lead')
- event_converted (text, default 'Purchase')

## RLS impact
- No policy changes needed. Existing CRUD policies already cover UPDATE/INSERT.
*/

ALTER TABLE meta_conversion_settings
  ADD COLUMN IF NOT EXISTS event_new text DEFAULT 'Lead',
  ADD COLUMN IF NOT EXISTS event_called_no_response text DEFAULT 'Contact',
  ADD COLUMN IF NOT EXISTS event_called_responded text DEFAULT 'Contact',
  ADD COLUMN IF NOT EXISTS event_interested text DEFAULT 'Contact',
  ADD COLUMN IF NOT EXISTS event_not_interested text DEFAULT 'Lead',
  ADD COLUMN IF NOT EXISTS event_converted text DEFAULT 'Purchase';
