/*
# Add Advanced Automation Features

1. Schema Changes to `automation_flows`
   - Add `webhook_url` (text, nullable) — unique URL for external webhook triggers
   - Add `time_window_config` (jsonb, default '{}') — time window settings (days of week, start/end hour, timezone)
   - Add `conversion_stats` (jsonb, default '{}') — cached conversion tracking stats per flow

2. Schema Changes to `automation_runs`
   - Add `is_test` (boolean, default false) — marks runs triggered by the Test/Preview feature
   - Add `result_summary` (text, nullable) — human-readable summary of what the test run did

3. New Table: `automation_suggestions`
   - Stores AI-powered smart suggestions for automation improvements
   - id (uuid PK)
   - user_id (uuid, not null, defaults to auth.uid())
   - suggestion_type (text) — e.g. 'response_time', 'channel_preference', 'follow_up_gap'
   - title (text)
   - description (text)
   - data (jsonb) — supporting metrics and chart data
   - confidence (numeric, 0-1)
   - status (text: 'new', 'dismissed', 'applied') default 'new'
   - created_at (timestamptz)

4. New Table: `automation_webhook_triggers`
   - Stores incoming webhook trigger events for external integrations
   - id (uuid PK)
   - flow_id (uuid FK → automation_flows ON DELETE CASCADE)
   - payload (jsonb) — the raw webhook payload
   - processed (boolean, default false)
   - created_at (timestamptz)

5. Security
   - RLS enabled on all new tables
   - Owner-scoped policies on automation_suggestions (user_id = auth.uid())
   - Owner-scoped policies on automation_webhook_triggers via flow ownership check
   - Existing automation_flows policies cover the new columns (same table, same ownership)

6. Indexes
   - Index on automation_flows(webhook_url) for webhook lookups
   - Index on automation_suggestions(user_id, status) for fetching new suggestions
   - Index on automation_webhook_triggers(flow_id, processed)
*/

-- Add columns to automation_flows
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_flows' AND column_name = 'webhook_url') THEN
    ALTER TABLE automation_flows ADD COLUMN webhook_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_flows' AND column_name = 'time_window_config') THEN
    ALTER TABLE automation_flows ADD COLUMN time_window_config jsonb DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_flows' AND column_name = 'conversion_stats') THEN
    ALTER TABLE automation_flows ADD COLUMN conversion_stats jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add columns to automation_runs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_runs' AND column_name = 'is_test') THEN
    ALTER TABLE automation_runs ADD COLUMN is_test boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_runs' AND column_name = 'result_summary') THEN
    ALTER TABLE automation_runs ADD COLUMN result_summary text;
  END IF;
END $$;

-- Create automation_suggestions table
CREATE TABLE IF NOT EXISTS automation_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  confidence numeric DEFAULT 0.5,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE automation_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_suggestions" ON automation_suggestions;
CREATE POLICY "select_own_suggestions" ON automation_suggestions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_suggestions" ON automation_suggestions;
CREATE POLICY "insert_own_suggestions" ON automation_suggestions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_suggestions" ON automation_suggestions;
CREATE POLICY "update_own_suggestions" ON automation_suggestions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_suggestions" ON automation_suggestions;
CREATE POLICY "delete_own_suggestions" ON automation_suggestions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Create automation_webhook_triggers table
CREATE TABLE IF NOT EXISTS automation_webhook_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
  payload jsonb DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE automation_webhook_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_webhook_triggers" ON automation_webhook_triggers;
CREATE POLICY "select_own_webhook_triggers" ON automation_webhook_triggers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_webhook_triggers.flow_id AND automation_flows.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_webhook_triggers" ON automation_webhook_triggers;
CREATE POLICY "insert_own_webhook_triggers" ON automation_webhook_triggers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_webhook_triggers.flow_id AND automation_flows.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_webhook_triggers" ON automation_webhook_triggers;
CREATE POLICY "update_own_webhook_triggers" ON automation_webhook_triggers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_webhook_triggers.flow_id AND automation_flows.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_webhook_triggers.flow_id AND automation_flows.user_id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_flows_webhook_url ON automation_flows(webhook_url) WHERE webhook_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_suggestions_user_status ON automation_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_automation_webhook_triggers_flow_processed ON automation_webhook_triggers(flow_id, processed);
