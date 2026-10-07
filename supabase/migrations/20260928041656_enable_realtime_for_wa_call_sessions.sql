/*
# Enable Realtime for WhatsApp Call Sessions Table

1. Changes
- Enable realtime publication on `wa_call_sessions` table so the frontend can subscribe to incoming call events.
- When a customer calls the WhatsApp Business number, the webhook inserts a row with status `incoming_ringing`.
- The frontend subscribes to INSERT events on this table and shows a ringing notification.
2. Security
- No policy changes. RLS is already enabled with owner-scoped policies.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE wa_call_sessions;
