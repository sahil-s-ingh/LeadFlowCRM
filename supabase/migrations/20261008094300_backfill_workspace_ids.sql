/*
# Multi-Workspace Support — Part 3: Backfill workspace_id

## Purpose
Create default workspaces for all existing users and backfill workspace_id
on all data tables from their existing user_id or owner_id column.
*/

-- Step 1: Create default workspaces for all users who have data
DO $$
DECLARE
  u record;
  v_wid uuid;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM submissions WHERE user_id IS NOT NULL LOOP
    v_wid := ensure_default_workspace(u.user_id);
  END LOOP;
  FOR u IN SELECT DISTINCT owner_id FROM team_members WHERE owner_id IS NOT NULL LOOP
    v_wid := ensure_default_workspace(u.owner_id);
  END LOOP;
  FOR u IN SELECT DISTINCT user_id FROM appearance_settings WHERE user_id IS NOT NULL LOOP
    v_wid := ensure_default_workspace(u.user_id);
  END LOOP;
  FOR u IN SELECT DISTINCT user_id FROM whatsapp_settings WHERE user_id IS NOT NULL LOOP
    v_wid := ensure_default_workspace(u.user_id);
  END LOOP;
  FOR u IN SELECT DISTINCT owner_id FROM role_permissions WHERE owner_id IS NOT NULL LOOP
    v_wid := ensure_default_workspace(u.owner_id);
  END LOOP;
END $$;

-- Step 2: Backfill workspace_id = user_id for all tables that have both columns
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN 
    SELECT c1.table_name FROM information_schema.columns c1
    WHERE c1.table_schema = 'public' 
    AND c1.column_name = 'workspace_id'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns c2 
      WHERE c2.table_schema = 'public' 
      AND c2.table_name = c1.table_name 
      AND c2.column_name = 'user_id'
    )
    AND c1.table_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
  LOOP
    EXECUTE format(
      'UPDATE %I SET workspace_id = user_id WHERE workspace_id IS NULL AND user_id IS NOT NULL',
      t.table_name
    );
  END LOOP;
END $$;

-- Step 3: Backfill tables with owner_id (team_members, role_permissions)
UPDATE team_members SET workspace_id = owner_id WHERE workspace_id IS NULL AND owner_id IS NOT NULL;
UPDATE role_permissions SET workspace_id = owner_id WHERE workspace_id IS NULL AND owner_id IS NOT NULL;

-- Step 4: Backfill child tables from parent using correct column names
UPDATE chat_messages m SET workspace_id = c.workspace_id 
  FROM chat_conversations c 
  WHERE m.conversation_id = c.id 
  AND m.workspace_id IS NULL 
  AND c.workspace_id IS NOT NULL;

UPDATE wa_messages m SET workspace_id = c.workspace_id 
  FROM wa_conversations c 
  WHERE m.conversation_id = c.id 
  AND m.workspace_id IS NULL 
  AND c.workspace_id IS NOT NULL;

UPDATE team_chat_messages SET workspace_id = (
  SELECT workspace_id FROM team_members tm WHERE team_chat_messages.sender_id = tm.id
) WHERE workspace_id IS NULL;

UPDATE automation_queue SET workspace_id = (
  SELECT workspace_id FROM automation_flows af WHERE automation_queue.flow_id = af.id
) WHERE workspace_id IS NULL;

UPDATE automation_runs SET workspace_id = (
  SELECT workspace_id FROM automation_flows af WHERE automation_runs.flow_id = af.id
) WHERE workspace_id IS NULL;

UPDATE automation_webhook_triggers SET workspace_id = (
  SELECT workspace_id FROM automation_flows af WHERE automation_webhook_triggers.flow_id = af.id
) WHERE workspace_id IS NULL;

UPDATE inbound_webhook_logs SET workspace_id = (
  SELECT workspace_id FROM inbound_webhook_keys k WHERE inbound_webhook_logs.api_key_id = k.id
) WHERE workspace_id IS NULL;

UPDATE wa_call_recordings SET workspace_id = (
  SELECT workspace_id FROM wa_call_sessions s WHERE wa_call_recordings.call_session_id = s.id
) WHERE workspace_id IS NULL;

UPDATE webhook_deliveries SET workspace_id = (
  SELECT workspace_id FROM webhooks w WHERE webhook_deliveries.webhook_id = w.id
) WHERE workspace_id IS NULL;
