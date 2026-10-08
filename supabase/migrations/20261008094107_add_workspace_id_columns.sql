/*
# Multi-Workspace Support — Part 2: Add workspace_id columns

## Purpose
Add a nullable `workspace_id` column to every data table in the CRM.
This column will be used for RLS-based workspace isolation.

## Changes
- Adds workspace_id uuid column to 73 data tables
- All columns are nullable initially (backfilled in Part 3)
*/

DO $$ BEGIN
  ALTER TABLE submissions ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE twilio_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE meta_conversion_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE meta_marketing_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE meta_ads_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE meta_ads_campaigns ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE lead_assignment_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE pipeline_autoassign_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE follow_up_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE popup_forms ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE inbound_webhook_keys ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE inbound_webhook_logs ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE api_integration_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE google_sheets_settings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE google_sheets_sync_log ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE lead_followups ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE custom_lead_fields ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE custom_lead_field_values ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE drip_campaigns ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE drip_steps ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE drip_enrollments ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE reply_templates ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE short_links ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE landing_page_appearance ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE email_log ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE email_broadcast_campaigns ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE email_broadcast_recipients ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE email_inbox_conversations ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE email_inbox_messages ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE ib_leads ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE telegram_broadcasts ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE telegram_broadcast_recipients ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE tg_broadcast_campaigns ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE tg_broadcast_recipients ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE tg_bot_flows ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE tg_bot_sessions ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE tg_bot_verifications ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE wa_broadcast_campaigns ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE wa_broadcast_recipients ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE wa_call_permissions ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE wa_call_sessions ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE wa_call_recordings ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE wa_conv_notes ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE wa_message_templates ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE campaign_alerts ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE campaign_snapshots ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE campaign_trends ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE optimization_logs ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE optimization_rules ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE automation_flows ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE automation_suggestions ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE automation_queue ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE automation_webhook_triggers ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE team_members ADD COLUMN IF NOT EXISTS workspace_id uuid;
  ALTER TABLE team_chat_messages ADD COLUMN IF NOT EXISTS workspace_id uuid;
END $$;
