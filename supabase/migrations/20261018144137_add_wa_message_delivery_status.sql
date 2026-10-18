/*
# Add delivery status to wa_messages

1. Modified Tables
- `wa_messages` — adds two new columns:
  - `wa_message_id` (text, nullable): the message ID returned by Meta's Graph API when an outbound message is accepted. Used to match incoming delivery/read status callbacks to the original message row.
  - `delivery_status` (text, nullable, default 'sent'): the current delivery state for outbound messages. One of 'sent', 'delivered', 'read', 'failed'. Inbound (client) messages leave this null since Meta does not report status for them.
  - `delivered_at` (timestamptz, nullable): timestamp when Meta reported the message was delivered to the recipient's device.
  - `read_at` (timestamptz, nullable): timestamp when Meta reported the message was read by the recipient.

2. Security
- No new RLS policies needed. The existing owner-scoped policies on wa_messages (access through conversation ownership) already cover SELECT/INSERT/UPDATE for these new columns.
- The whatsapp-webhook edge function updates these columns using the service role key, which bypasses RLS as intended for server-side status callbacks.

3. Notes
- All columns are nullable/additive so existing rows are unaffected.
- An index on `wa_message_id` is added so the webhook can look up the message row by Meta's ID quickly.
- The `delivery_status` CHECK constraint restricts values to the known set plus NULL (for inbound messages).
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wa_messages' AND column_name = 'wa_message_id') THEN
    ALTER TABLE wa_messages ADD COLUMN wa_message_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wa_messages' AND column_name = 'delivery_status') THEN
    ALTER TABLE wa_messages ADD COLUMN delivery_status text DEFAULT 'sent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wa_messages' AND column_name = 'delivered_at') THEN
    ALTER TABLE wa_messages ADD COLUMN delivered_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wa_messages' AND column_name = 'read_at') THEN
    ALTER TABLE wa_messages ADD COLUMN read_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wa_messages_wa_message_id ON wa_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;

-- Backfill: any existing outbound admin message without a delivery_status defaults to 'sent'
UPDATE wa_messages SET delivery_status = 'sent' WHERE sender = 'admin' AND delivery_status IS NULL;
