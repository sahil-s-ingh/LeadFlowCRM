/*
# Enhance WhatsApp Broadcast with Scheduling, Variable Mapping, Phone Selection & Read Receipts

## What this does
Enhances the existing wa_broadcast_campaigns and wa_broadcast_recipients tables to support:
1. Scheduled broadcasts (send at a future date/time)
2. Per-recipient variable mapping (auto-fill template variables from lead data)
3. Phone number selection (send from a specific connected WhatsApp number)
4. Read receipt tracking (delivered + read timestamps)
5. Campaign naming (custom names for easy identification)
6. CSV recipient upload support (manual phone list, not just lead filters)

## Changes

### wa_broadcast_campaigns (modified)
- campaign_name (text) — custom display name for the campaign
- scheduled_at (timestamptz) — when to auto-send the campaign (null = send manually)
- phone_number_id (text) — which connected WhatsApp number to send from
- variable_mapping (jsonb) — maps template variables to lead fields, e.g. {"1": "full_name", "2": "email"}
- read_count (integer, default 0) — number of recipients who read the message

### wa_broadcast_recipients (modified)
- read_at (timestamptz) — when the recipient read the message
- recipient_name (text) — name for manual (CSV) recipients
- variable_values (jsonb) — resolved variable values for this recipient, e.g. {"1": "John", "2": "john@example.com"}
- is_manual (boolean, default false) — whether this recipient was added via CSV upload vs lead filter

## Security
- All existing RLS policies remain in place (owner-scoped via user_id)
- New columns inherit existing policies

## Notes
1. All new columns are nullable or have safe defaults — no data loss
2. The existing send flow continues to work unchanged
3. Variable mapping enables templates like "Hi {{1}}, your code is {{2}}" to auto-fill from lead names
*/

-- Add new columns to wa_broadcast_campaigns
ALTER TABLE wa_broadcast_campaigns ADD COLUMN IF NOT EXISTS campaign_name text;
ALTER TABLE wa_broadcast_campaigns ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE wa_broadcast_campaigns ADD COLUMN IF NOT EXISTS phone_number_id text;
ALTER TABLE wa_broadcast_campaigns ADD COLUMN IF NOT EXISTS variable_mapping jsonb DEFAULT '{}'::jsonb;
ALTER TABLE wa_broadcast_campaigns ADD COLUMN IF NOT EXISTS read_count integer NOT NULL DEFAULT 0;

-- Add new columns to wa_broadcast_recipients
ALTER TABLE wa_broadcast_recipients ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE wa_broadcast_recipients ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE wa_broadcast_recipients ADD COLUMN IF NOT EXISTS variable_values jsonb DEFAULT '{}'::jsonb;
ALTER TABLE wa_broadcast_recipients ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;

-- Index for scheduled broadcast lookup
CREATE INDEX IF NOT EXISTS idx_wa_broadcast_scheduled ON wa_broadcast_campaigns(scheduled_at) WHERE scheduled_at IS NOT NULL AND status = 'draft';
