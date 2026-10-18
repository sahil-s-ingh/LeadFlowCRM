/*
# Schedule cron for WhatsApp drip sequence processor

Adds a pg_cron job that calls the process-wa-drips edge function every 5
minutes. The edge function finds active enrollments whose next_step_at has
arrived, sends the appropriate WhatsApp message, and advances enrollment
progress.
*/

SELECT cron.schedule(
  'process-wa-drips',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://jbmbjlvmaojxfztfbqxn.supabase.co/functions/v1/process-wa-drips',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
