/*
# Add provider and agent_number columns to twilio_settings

1. Modified Tables
- `twilio_settings`: Added `provider` column (text, values: 'twilio' | 'exotel' | 'plivo', default 'twilio') and `agent_number` column (text, the agent's own phone number that the virtual number forwards to — used by Exotel and Plivo which require a "to" number for the agent).
2. Security
- No policy changes — existing owner-scoped RLS on twilio_settings already covers these columns.
*/

ALTER TABLE twilio_settings
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'twilio',
  ADD COLUMN IF NOT EXISTS agent_number text NOT NULL DEFAULT '';
