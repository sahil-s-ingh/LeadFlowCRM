/*
# Drop Webhooks, Google Sheets Sync, and Inbound Webhook tables

## Purpose
Removes all database tables and cron schedules for the Webhooks, Google Sheets Sync,
and Inbound Webhook features that have been removed from the frontend and backend.

## Tables dropped (all data lost — features are fully removed)
1. `webhook_deliveries` — delivery log for outbound webhooks
2. `webhooks` — outbound webhook configurations (Zapier/Make.com etc.)
3. `inbound_webhook_logs` — request log for inbound webhook lead creation
4. `inbound_webhook_keys` — API keys for inbound webhook lead creation
5. `google_sheets_sync_log` — row-level sync log for Google Sheets import
6. `google_sheets_settings` — Google Sheets sync configurations

## Cron schedules removed
- `sync-google-sheets` cron job (ran every 5 minutes)

## Important notes
- These features are permanently removed from the application.
- All existing webhook configurations, delivery logs, inbound keys/logs, and Google Sheets configs/sync logs will be deleted.
- Telegram/WhatsApp webhook setup (handleSetupWebhook, telegram-webhook, whatsapp-webhook edge functions) are NOT affected — those are separate features that remain.
*/

-- Drop tables in dependency order (child tables first)
DROP TABLE IF EXISTS webhook_deliveries CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;
DROP TABLE IF EXISTS inbound_webhook_logs CASCADE;
DROP TABLE IF EXISTS inbound_webhook_keys CASCADE;
DROP TABLE IF EXISTS google_sheets_sync_log CASCADE;
DROP TABLE IF EXISTS google_sheets_settings CASCADE;

-- Remove the Google Sheets sync cron schedule
SELECT cron.unschedule('sync-google-sheets');
