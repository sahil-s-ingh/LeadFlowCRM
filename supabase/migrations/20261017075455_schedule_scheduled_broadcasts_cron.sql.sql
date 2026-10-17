/*
# Cron job for auto-sending scheduled WhatsApp broadcasts

## What this does
Creates a cron job that runs every minute and calls the `process-scheduled-broadcasts`
edge function. That function finds all campaigns with status "scheduled" whose
scheduled_at time has passed, and automatically sends them — no manual click required.

## Security
- The cron job calls the edge function via HTTP (verify_jwt = false, public endpoint)
- The edge function uses the service role key internally
- No auth header needed — the function is designed for cron invocation only

## Notes
1. Runs every minute to ensure scheduled broadcasts send promptly
2. The edge function handles all logic (finding due campaigns, sending, updating status)
3. If a campaign's WhatsApp settings are not configured, it's marked as failed
*/

SELECT cron.schedule(
  'process-scheduled-broadcasts',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/process-scheduled-broadcasts',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
