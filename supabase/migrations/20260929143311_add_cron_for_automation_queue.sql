-- Add cron job to process the automation queue every 5 minutes
-- The process-automations edge function handles mode=process_queue to execute delayed actions

SELECT cron.schedule(
  'process-automation-queue',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://jbmbjlvmaojxfztfbqxn.supabase.co/functions/v1/process-automations',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"mode": "process_queue"}'::jsonb
    );
  $$
);
