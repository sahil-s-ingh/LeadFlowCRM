-- Re-schedule the follow-up processor with the correct hardcoded URL.
-- The original migration used '${SUPABASE_URL}' literally, which was never
-- substituted, so the cron job was calling a broken URL and the edge
-- function was never invoked.

SELECT cron.schedule(
  'process-follow-up-reminders',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://suzlajuminuyddwqsufc.supabase.co/functions/v1/process-followups',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
