/*
# Schedule cron for scheduled WhatsApp message processor

Adds a pg_cron job that runs `process-scheduled-wa-messages` every minute,
sending due scheduled messages from the lead WhatsApp drawer.
*/

SELECT cron.schedule(
  'process-scheduled-wa-messages',
  '* * * * *',
  $$SELECT net.http_post(
    url := '{{SUPABASE_URL}}/functions/v1/process-scheduled-wa-messages',
    headers := '{"Content-Type": "application/json"}'::jsonb
  )$$
);