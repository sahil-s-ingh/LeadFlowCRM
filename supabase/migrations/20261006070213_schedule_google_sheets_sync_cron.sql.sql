/*
# Schedule Google Sheets Sync Cron Job

## Purpose
Runs the google-sheets-sync edge function every 5 minutes to automatically
import new rows from connected Google Sheets into the submissions (Lead Centre) table.

## Changes
- Schedules a pg_cron job named 'sync-google-sheets' that POSTs to the
  google-sheets-sync edge function every 5 minutes.

## Notes
- Uses the same pattern as the existing process-followups and process-scheduled-emails cron jobs.
*/

SELECT cron.schedule(
  'sync-google-sheets',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://jbmbjlvmaojxfztfbqxn.supabase.co/functions/v1/google-sheets-sync',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);