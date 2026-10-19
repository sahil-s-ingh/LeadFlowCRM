/*
# Cron job for processing WhatsApp drip sequence steps

## What this does
Creates a cron job that runs every hour and calls the `process-drip-sequences`
edge function. That function finds all active drip sequences, identifies steps
whose offset_days have elapsed since the sequence started, and sends the
template messages to the step's pending recipients.

## Security
- The cron job calls the edge function via HTTP (verify_jwt = false, public endpoint)
- The edge function uses the service role key internally
- No auth header needed — designed for cron invocation only

## Notes
1. Runs every hour — drip steps are day-offset based so hourly is sufficient
2. The edge function handles all logic (finding due steps, sending, marking completed)
3. Opted-out recipients are skipped automatically
*/

SELECT cron.schedule(
  'process-drip-sequences',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/process-drip-sequences',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
