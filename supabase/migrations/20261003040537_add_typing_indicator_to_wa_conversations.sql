/*
# Add typing indicator columns to wa_conversations

1. Modified Tables
- `wa_conversations` — adds two new columns:
  - `is_typing` (boolean, default false): set to true when the WhatsApp client is actively typing a message.
  - `typing_at` (timestamptz, nullable): timestamp of the last typing event, used to auto-expire stale typing states.

2. Security
- No new RLS policies needed. The existing policies on `wa_conversations` already cover SELECT/INSERT/UPDATE/DELETE for authenticated users.
- The whatsapp-webhook edge function (which runs with the service role key) will UPDATE these columns when Meta sends a typing status webhook.
- The frontend will read `is_typing` to display the indicator.

3. Notes
- Columns are nullable/boolean so existing rows are unaffected.
- The frontend will subscribe to realtime changes on `wa_conversations` to show the typing indicator live.
- A stale typing state (older than 8 seconds) will be treated as "not typing" by the frontend.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wa_conversations' AND column_name = 'is_typing') THEN
    ALTER TABLE wa_conversations ADD COLUMN is_typing boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wa_conversations' AND column_name = 'typing_at') THEN
    ALTER TABLE wa_conversations ADD COLUMN typing_at timestamptz DEFAULT now();
  END IF;
END $$;