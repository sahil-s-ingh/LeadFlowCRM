/*
# Schedule VIP join tracking cron + realtime

1. Cron Job
- Creates a pg_cron job that calls the `process-vip-joins` edge function every 5 minutes.
- This polls active pending invite links via Telegram API to detect joins missed by the webhook.

2. Realtime
- Enables realtime on `telegram_invite_links` so the lead drawer gets instant join status updates.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.schedule(
  'process-vip-joins-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jbmbjlvmaojxfztfbqxn.supabase.co/functions/v1/process-vip-joins',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object()
  ) AS response;
  $$
);

-- Enable realtime for telegram_invite_links so the UI gets instant updates
ALTER TABLE telegram_invite_links REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'telegram_invite_links'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE telegram_invite_links;
  END IF;
END $$;
