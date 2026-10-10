/*
# Revert Workspace-Based RLS Back to User ID-Based RLS

## What This Does

This migration removes the workspace multi-tenancy layer that was added on Oct 8.
It restores the original user_id/owner_id-based row-level security policies on all
~72 data tables, then drops the workspace_id columns, indexes, helper functions,
and the workspaces table itself.

## Why

The workspace feature was causing the "Add Lead" popup to fail because inserts
were missing the workspace_id field. Rather than keep the workspace layer, we're
reverting to the simpler and proven user_id-based ownership model.

## Changes

1. For every table with a user_id column that also had workspace_id:
   - Drop all workspace-scoped policies (_ws_select, _ws_insert, _ws_update, _ws_delete)
   - Recreate user_id-based policies (SELECT/INSERT/UPDATE/DELETE scoped to auth.uid() = user_id)

2. For tables with owner_id instead of user_id (role_permissions, team_members):
   - Recreate owner_id-based policies

3. For child tables without a user_id/owner_id column:
   - Use parent-scoped EXISTS subquery policies referencing the parent table's user_id

4. Restore anon policies for public-facing tables (submissions, popup_forms,
   short_links, landing_page_appearance, telegram_settings)

5. Drop workspace_id columns from all tables
6. Drop workspace_id indexes
7. Drop ensure_default_workspace() and user_workspace_ids() functions
8. Drop the workspaces table

## Important Notes

- All existing data is preserved. The workspace_id columns being dropped are
  nullable and were only used for RLS predicates, not for application logic.
- The user_id columns already contain the correct owner and remain after this migration.
- The anon INSERT policy on submissions allows public form submissions to work.
*/

-- ============================================================
-- STEP 1: Drop workspace policies and recreate user_id policies
--          for all tables with user_id column
-- ============================================================

DO $$
DECLARE
  t text;
  tables_with_user_id text[] := ARRAY[
    'api_integration_settings','appearance_settings','automation_flows',
    'automation_suggestions','call_logs','campaign_alerts','campaign_snapshots',
    'campaign_trends','chat_conversations','custom_lead_field_values',
    'custom_lead_fields','drip_campaigns','drip_enrollments','drip_steps',
    'email_broadcast_campaigns','email_broadcast_recipients','email_inbox_conversations',
    'email_inbox_messages','email_log','email_templates','follow_up_settings',
    'google_sheets_settings','google_sheets_sync_log','ib_leads',
    'inbound_webhook_keys','landing_page_appearance','lead_activities',
    'lead_assignment_settings','lead_followups','meta_ads_campaigns',
    'meta_ads_settings','meta_conversion_settings','meta_marketing_settings',
    'optimization_logs','optimization_rules','pipeline_autoassign_settings',
    'popup_forms','reply_templates','scheduled_emails','short_links',
    'smtp_settings','submissions','telegram_broadcasts','telegram_settings',
    'tg_bot_flows','tg_bot_sessions','tg_bot_verifications','tg_broadcast_campaigns',
    'tg_broadcast_recipients','twilio_settings','wa_broadcast_campaigns',
    'wa_broadcast_recipients','wa_call_permissions','wa_call_sessions',
    'wa_conv_notes','wa_conversations','wa_message_templates','webhook_deliveries',
    'webhooks','whatsapp_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_user_id LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_ws_select', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_ws_insert', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_ws_update', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_ws_delete', t);

      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (auth.uid() = user_id);', t || '_owner_select', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);', t || '_owner_insert', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);', t || '_owner_update', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth.uid() = user_id);', t || '_owner_delete', t);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping table %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- STEP 2: Handle owner_id tables (role_permissions, team_members)
-- ============================================================

DO $$
BEGIN
  -- role_permissions
  BEGIN
    DROP POLICY IF EXISTS "role_permissions_ws_select" ON role_permissions;
    DROP POLICY IF EXISTS "role_permissions_ws_insert" ON role_permissions;
    DROP POLICY IF EXISTS "role_permissions_ws_update" ON role_permissions;
    DROP POLICY IF EXISTS "role_permissions_ws_delete" ON role_permissions;

    CREATE POLICY "role_permissions_owner_select" ON role_permissions FOR SELECT TO authenticated USING (auth.uid() = owner_id);
    CREATE POLICY "role_permissions_owner_insert" ON role_permissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
    CREATE POLICY "role_permissions_owner_update" ON role_permissions FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
    CREATE POLICY "role_permissions_owner_delete" ON role_permissions FOR DELETE TO authenticated USING (auth.uid() = owner_id);
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'role_permissions: %', SQLERRM; END;

  -- team_members
  BEGIN
    DROP POLICY IF EXISTS "team_members_ws_select" ON team_members;
    DROP POLICY IF EXISTS "team_members_ws_insert" ON team_members;
    DROP POLICY IF EXISTS "team_members_ws_update" ON team_members;
    DROP POLICY IF EXISTS "team_members_ws_delete" ON team_members;

    CREATE POLICY "team_members_owner_select" ON team_members FOR SELECT TO authenticated USING (auth.uid() = owner_id);
    CREATE POLICY "team_members_owner_insert" ON team_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
    CREATE POLICY "team_members_owner_update" ON team_members FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
    CREATE POLICY "team_members_owner_delete" ON team_members FOR DELETE TO authenticated USING (auth.uid() = owner_id);
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'team_members: %', SQLERRM; END;
END $$;

-- ============================================================
-- STEP 3: Handle child tables without user_id/owner_id
--          Use parent-scoped EXISTS policies
-- ============================================================

DO $$
BEGIN
  -- chat_messages -> chat_conversations
  BEGIN
    DROP POLICY IF EXISTS "chat_messages_ws_select" ON chat_messages;
    DROP POLICY IF EXISTS "chat_messages_ws_insert" ON chat_messages;
    DROP POLICY IF EXISTS "chat_messages_ws_update" ON chat_messages;
    DROP POLICY IF EXISTS "chat_messages_ws_delete" ON chat_messages;

    CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND chat_conversations.user_id = auth.uid()));
    CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND chat_conversations.user_id = auth.uid()));
    CREATE POLICY "chat_messages_update" ON chat_messages FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND chat_conversations.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND chat_conversations.user_id = auth.uid()));
    CREATE POLICY "chat_messages_delete" ON chat_messages FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND chat_conversations.user_id = auth.uid()));
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'chat_messages: %', SQLERRM; END;

  -- wa_messages -> wa_conversations
  BEGIN
    DROP POLICY IF EXISTS "wa_messages_ws_select" ON wa_messages;
    DROP POLICY IF EXISTS "wa_messages_ws_insert" ON wa_messages;
    DROP POLICY IF EXISTS "wa_messages_ws_update" ON wa_messages;
    DROP POLICY IF EXISTS "wa_messages_ws_delete" ON wa_messages;

    CREATE POLICY "wa_messages_select" ON wa_messages FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM wa_conversations WHERE wa_conversations.id = wa_messages.conversation_id AND wa_conversations.user_id = auth.uid()));
    CREATE POLICY "wa_messages_insert" ON wa_messages FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM wa_conversations WHERE wa_conversations.id = wa_messages.conversation_id AND wa_conversations.user_id = auth.uid()));
    CREATE POLICY "wa_messages_update" ON wa_messages FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM wa_conversations WHERE wa_conversations.id = wa_messages.conversation_id AND wa_conversations.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM wa_conversations WHERE wa_conversations.id = wa_messages.conversation_id AND wa_conversations.user_id = auth.uid()));
    CREATE POLICY "wa_messages_delete" ON wa_messages FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM wa_conversations WHERE wa_conversations.id = wa_messages.conversation_id AND wa_conversations.user_id = auth.uid()));
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'wa_messages: %', SQLERRM; END;

  -- team_chat_messages has team_owner_id
  BEGIN
    DROP POLICY IF EXISTS "team_chat_messages_ws_select" ON team_chat_messages;
    DROP POLICY IF EXISTS "team_chat_messages_ws_insert" ON team_chat_messages;
    DROP POLICY IF EXISTS "team_chat_messages_ws_update" ON team_chat_messages;
    DROP POLICY IF EXISTS "team_chat_messages_ws_delete" ON team_chat_messages;

    CREATE POLICY "team_chat_messages_select" ON team_chat_messages FOR SELECT TO authenticated USING (auth.uid() = team_owner_id);
    CREATE POLICY "team_chat_messages_insert" ON team_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = team_owner_id);
    CREATE POLICY "team_chat_messages_update" ON team_chat_messages FOR UPDATE TO authenticated USING (auth.uid() = team_owner_id) WITH CHECK (auth.uid() = team_owner_id);
    CREATE POLICY "team_chat_messages_delete" ON team_chat_messages FOR DELETE TO authenticated USING (auth.uid() = team_owner_id);
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'team_chat_messages: %', SQLERRM; END;

  -- automation_queue -> automation_flows
  BEGIN
    DROP POLICY IF EXISTS "automation_queue_ws_select" ON automation_queue;
    DROP POLICY IF EXISTS "automation_queue_ws_insert" ON automation_queue;
    DROP POLICY IF EXISTS "automation_queue_ws_update" ON automation_queue;
    DROP POLICY IF EXISTS "automation_queue_ws_delete" ON automation_queue;

    CREATE POLICY "automation_queue_select" ON automation_queue FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_queue.flow_id AND automation_flows.user_id = auth.uid()));
    CREATE POLICY "automation_queue_insert" ON automation_queue FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_queue.flow_id AND automation_flows.user_id = auth.uid()));
    CREATE POLICY "automation_queue_update" ON automation_queue FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_queue.flow_id AND automation_flows.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_queue.flow_id AND automation_flows.user_id = auth.uid()));
    CREATE POLICY "automation_queue_delete" ON automation_queue FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_queue.flow_id AND automation_flows.user_id = auth.uid()));
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'automation_queue: %', SQLERRM; END;

  -- automation_runs -> automation_flows
  BEGIN
    DROP POLICY IF EXISTS "automation_runs_ws_select" ON automation_runs;
    DROP POLICY IF EXISTS "automation_runs_ws_insert" ON automation_runs;
    DROP POLICY IF EXISTS "automation_runs_ws_update" ON automation_runs;
    DROP POLICY IF EXISTS "automation_runs_ws_delete" ON automation_runs;

    CREATE POLICY "automation_runs_select" ON automation_runs FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_runs.flow_id AND automation_flows.user_id = auth.uid()));
    CREATE POLICY "automation_runs_insert" ON automation_runs FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_runs.flow_id AND automation_flows.user_id = auth.uid()));
    CREATE POLICY "automation_runs_update" ON automation_runs FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_runs.flow_id AND automation_flows.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_runs.flow_id AND automation_flows.user_id = auth.uid()));
    CREATE POLICY "automation_runs_delete" ON automation_runs FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_runs.flow_id AND automation_flows.user_id = auth.uid()));
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'automation_runs: %', SQLERRM; END;

  -- automation_webhook_triggers -> automation_flows
  BEGIN
    DROP POLICY IF EXISTS "automation_webhook_triggers_ws_select" ON automation_webhook_triggers;
    DROP POLICY IF EXISTS "automation_webhook_triggers_ws_insert" ON automation_webhook_triggers;
    DROP POLICY IF EXISTS "automation_webhook_triggers_ws_update" ON automation_webhook_triggers;
    DROP POLICY IF EXISTS "automation_webhook_triggers_ws_delete" ON automation_webhook_triggers;

    CREATE POLICY "automation_webhook_triggers_select" ON automation_webhook_triggers FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_webhook_triggers.flow_id AND automation_flows.user_id = auth.uid()));
    CREATE POLICY "automation_webhook_triggers_insert" ON automation_webhook_triggers FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_webhook_triggers.flow_id AND automation_flows.user_id = auth.uid()));
    CREATE POLICY "automation_webhook_triggers_update" ON automation_webhook_triggers FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_webhook_triggers.flow_id AND automation_flows.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_webhook_triggers.flow_id AND automation_flows.user_id = auth.uid()));
    CREATE POLICY "automation_webhook_triggers_delete" ON automation_webhook_triggers FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_webhook_triggers.flow_id AND automation_flows.user_id = auth.uid()));
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'automation_webhook_triggers: %', SQLERRM; END;

  -- inbound_webhook_logs -> inbound_webhook_keys
  BEGIN
    DROP POLICY IF EXISTS "inbound_webhook_logs_ws_select" ON inbound_webhook_logs;
    DROP POLICY IF EXISTS "inbound_webhook_logs_ws_insert" ON inbound_webhook_logs;
    DROP POLICY IF EXISTS "inbound_webhook_logs_ws_update" ON inbound_webhook_logs;
    DROP POLICY IF EXISTS "inbound_webhook_logs_ws_delete" ON inbound_webhook_logs;

    CREATE POLICY "inbound_webhook_logs_select" ON inbound_webhook_logs FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM inbound_webhook_keys WHERE inbound_webhook_keys.id = inbound_webhook_logs.api_key_id AND inbound_webhook_keys.user_id = auth.uid()));
    CREATE POLICY "inbound_webhook_logs_insert" ON inbound_webhook_logs FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM inbound_webhook_keys WHERE inbound_webhook_keys.id = inbound_webhook_logs.api_key_id AND inbound_webhook_keys.user_id = auth.uid()));
    CREATE POLICY "inbound_webhook_logs_update" ON inbound_webhook_logs FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM inbound_webhook_keys WHERE inbound_webhook_keys.id = inbound_webhook_logs.api_key_id AND inbound_webhook_keys.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM inbound_webhook_keys WHERE inbound_webhook_keys.id = inbound_webhook_logs.api_key_id AND inbound_webhook_keys.user_id = auth.uid()));
    CREATE POLICY "inbound_webhook_logs_delete" ON inbound_webhook_logs FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM inbound_webhook_keys WHERE inbound_webhook_keys.id = inbound_webhook_logs.api_key_id AND inbound_webhook_keys.user_id = auth.uid()));
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'inbound_webhook_logs: %', SQLERRM; END;

  -- telegram_broadcast_recipients -> telegram_broadcasts
  BEGIN
    DROP POLICY IF EXISTS "telegram_broadcast_recipients_ws_select" ON telegram_broadcast_recipients;
    DROP POLICY IF EXISTS "telegram_broadcast_recipients_ws_insert" ON telegram_broadcast_recipients;
    DROP POLICY IF EXISTS "telegram_broadcast_recipients_ws_update" ON telegram_broadcast_recipients;
    DROP POLICY IF EXISTS "telegram_broadcast_recipients_ws_delete" ON telegram_broadcast_recipients;

    CREATE POLICY "telegram_broadcast_recipients_select" ON telegram_broadcast_recipients FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM telegram_broadcasts WHERE telegram_broadcasts.id = telegram_broadcast_recipients.broadcast_id AND telegram_broadcasts.user_id = auth.uid()));
    CREATE POLICY "telegram_broadcast_recipients_insert" ON telegram_broadcast_recipients FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM telegram_broadcasts WHERE telegram_broadcasts.id = telegram_broadcast_recipients.broadcast_id AND telegram_broadcasts.user_id = auth.uid()));
    CREATE POLICY "telegram_broadcast_recipients_update" ON telegram_broadcast_recipients FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM telegram_broadcasts WHERE telegram_broadcasts.id = telegram_broadcast_recipients.broadcast_id AND telegram_broadcasts.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM telegram_broadcasts WHERE telegram_broadcasts.id = telegram_broadcast_recipients.broadcast_id AND telegram_broadcasts.user_id = auth.uid()));
    CREATE POLICY "telegram_broadcast_recipients_delete" ON telegram_broadcast_recipients FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM telegram_broadcasts WHERE telegram_broadcasts.id = telegram_broadcast_recipients.broadcast_id AND telegram_broadcasts.user_id = auth.uid()));
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'telegram_broadcast_recipients: %', SQLERRM; END;

  -- wa_call_recordings -> wa_call_sessions
  BEGIN
    DROP POLICY IF EXISTS "wa_call_recordings_ws_select" ON wa_call_recordings;
    DROP POLICY IF EXISTS "wa_call_recordings_ws_insert" ON wa_call_recordings;
    DROP POLICY IF EXISTS "wa_call_recordings_ws_update" ON wa_call_recordings;
    DROP POLICY IF EXISTS "wa_call_recordings_ws_delete" ON wa_call_recordings;

    CREATE POLICY "wa_call_recordings_select" ON wa_call_recordings FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM wa_call_sessions WHERE wa_call_sessions.id = wa_call_recordings.call_session_id AND wa_call_sessions.user_id = auth.uid()));
    CREATE POLICY "wa_call_recordings_insert" ON wa_call_recordings FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM wa_call_sessions WHERE wa_call_sessions.id = wa_call_recordings.call_session_id AND wa_call_sessions.user_id = auth.uid()));
    CREATE POLICY "wa_call_recordings_update" ON wa_call_recordings FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM wa_call_sessions WHERE wa_call_sessions.id = wa_call_recordings.call_session_id AND wa_call_sessions.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM wa_call_sessions WHERE wa_call_sessions.id = wa_call_recordings.call_session_id AND wa_call_sessions.user_id = auth.uid()));
    CREATE POLICY "wa_call_recordings_delete" ON wa_call_recordings FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM wa_call_sessions WHERE wa_call_sessions.id = wa_call_recordings.call_session_id AND wa_call_sessions.user_id = auth.uid()));
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'wa_call_recordings: %', SQLERRM; END;
END $$;

-- ============================================================
-- STEP 4: Restore anon policies for public-facing tables
-- ============================================================

-- submissions: allow anon to insert (public lead capture forms)
DROP POLICY IF EXISTS "submissions_anon_insert" ON submissions;
CREATE POLICY "submissions_anon_insert" ON submissions FOR INSERT
  TO anon WITH CHECK (true);

-- popup_forms: anon can read
DROP POLICY IF EXISTS "popup_forms_anon_select" ON popup_forms;
CREATE POLICY "popup_forms_anon_select" ON popup_forms FOR SELECT
  TO anon USING (true);

-- short_links: anon can read and update (click tracking)
DROP POLICY IF EXISTS "short_links_anon_select" ON short_links;
CREATE POLICY "short_links_anon_select" ON short_links FOR SELECT
  TO anon USING (true);
DROP POLICY IF EXISTS "short_links_anon_update" ON short_links;
CREATE POLICY "short_links_anon_update" ON short_links FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- landing_page_appearance: anon can read
DROP POLICY IF EXISTS "landing_page_appearance_anon_select" ON landing_page_appearance;
CREATE POLICY "landing_page_appearance_anon_select" ON landing_page_appearance FOR SELECT
  TO anon USING (true);

-- telegram_settings: anon can read
DROP POLICY IF EXISTS "telegram_settings_anon_select" ON telegram_settings;
CREATE POLICY "telegram_settings_anon_select" ON telegram_settings FOR SELECT
  TO anon USING (true);

-- ============================================================
-- STEP 5: Drop workspace_id indexes from all tables
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%_workspace_id'
  LOOP
    BEGIN
      EXECUTE format('DROP INDEX IF EXISTS %I;', r.indexname);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- ============================================================
-- STEP 6: Drop workspace_id columns from all tables
-- ============================================================

DO $$
DECLARE
  t text;
  ws_tables text[] := ARRAY[
    'api_integration_settings','appearance_settings','automation_flows',
    'automation_queue','automation_runs','automation_suggestions',
    'automation_webhook_triggers','call_logs','campaign_alerts',
    'campaign_snapshots','campaign_trends','chat_conversations',
    'chat_messages','custom_lead_field_values','custom_lead_fields',
    'drip_campaigns','drip_enrollments','drip_steps',
    'email_broadcast_campaigns','email_broadcast_recipients',
    'email_inbox_conversations','email_inbox_messages','email_log',
    'email_templates','follow_up_settings','google_sheets_settings',
    'google_sheets_sync_log','ib_leads','inbound_webhook_keys',
    'inbound_webhook_logs','landing_page_appearance','lead_activities',
    'lead_assignment_settings','lead_followups','meta_ads_campaigns',
    'meta_ads_settings','meta_conversion_settings','meta_marketing_settings',
    'optimization_logs','optimization_rules','pipeline_autoassign_settings',
    'popup_forms','reply_templates','role_permissions','scheduled_emails',
    'short_links','smtp_settings','submissions','team_chat_messages',
    'team_members','telegram_broadcast_recipients','telegram_broadcasts',
    'telegram_settings','tg_bot_flows','tg_bot_sessions','tg_bot_verifications',
    'tg_broadcast_campaigns','tg_broadcast_recipients','twilio_settings',
    'wa_broadcast_campaigns','wa_broadcast_recipients','wa_call_permissions',
    'wa_call_recordings','wa_call_sessions','wa_conv_notes','wa_conversations',
    'wa_message_templates','wa_messages','webhook_deliveries','webhooks',
    'whatsapp_settings'
  ];
BEGIN
  FOREACH t IN ARRAY ws_tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS workspace_id;', t);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not drop workspace_id on %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- STEP 7: Drop helper functions and workspaces table
-- ============================================================

DROP FUNCTION IF EXISTS public.ensure_default_workspace(uuid);
DROP FUNCTION IF EXISTS public.user_workspace_ids();
DROP TABLE IF EXISTS public.workspaces CASCADE;

-- ============================================================
-- STEP 8: Restore team_members unique constraint without workspace_id
--          (the workspace migration had changed it to include workspace_id)
-- ============================================================

DO $$
BEGIN
  -- Drop the workspace-based unique constraint if it exists
  EXECUTE 'ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_owner_id_email_workspace_id_key';
  -- Recreate the original unique constraint
  EXECUTE 'ALTER TABLE team_members ADD CONSTRAINT team_members_owner_email_unique UNIQUE (owner_id, email)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'team_members constraint: %', SQLERRM;
END $$;