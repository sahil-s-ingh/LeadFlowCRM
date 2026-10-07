-- Fix both cron jobs that were pointing to wrong URLs:
-- 1. process-follow-up-reminders: hardcoded wrong project URL (suzlajuminuyddwqsufc)
-- 2. process-scheduled-emails: used literal '${SUPABASE_URL}' placeholder that was never substituted

SELECT cron.unschedule('process-follow-up-reminders');
SELECT cron.unschedule('process-scheduled-emails');

SELECT cron.schedule(
  'process-follow-up-reminders',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://jbmbjlvmaojxfztfbqxn.supabase.co/functions/v1/process-followups',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'process-scheduled-emails',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://jbmbjlvmaojxfztfbqxn.supabase.co/functions/v1/process-scheduled-emails',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
