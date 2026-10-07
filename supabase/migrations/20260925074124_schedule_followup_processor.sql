/*
# Schedule follow-up reminder processor

1. Purpose
- Creates a pg_cron job that calls the process-followups edge function every 5 minutes.
- The edge function checks for due lead_followups with status='pending' and sends email reminders to the user's configured personal email.

2. Changes
- Enables pg_cron extension if not already enabled.
- Schedules a job named "process-follow-up-reminders" to run every 5 minutes.
- The job sends an HTTP POST to the edge function URL.

3. Notes
- The edge function reads follow_up_settings and smtp_settings per user to send personalized reminder emails.
- Reminders are marked as "sent" after successful email delivery, or "skipped" if the user hasn't configured reminders.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'process-follow-up-reminders',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := '${SUPABASE_URL}' || '/functions/v1/process-followups',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
