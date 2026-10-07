/*
# Create Automation Builder Tables

1. New Tables
- `automation_flows`: Stores automation workflows (trigger + actions config). Each flow belongs to an authenticated user.
  - id (uuid PK)
  - name (text, not null)
  - description (text)
  - trigger_type (text, not null) — e.g. 'lead_created', 'whatsapp_received', 'lead_status_changed', 'telegram_received', 'email_opened'
  - trigger_config (jsonb) — optional filter config for the trigger (e.g. which product, which status)
  - actions (jsonb, not null) — array of action objects [{type, config}]
  - is_active (boolean, default true)
  - user_id (uuid, not null, defaults to auth.uid())
  - created_at, updated_at (timestamptz)
- `automation_runs`: Execution log for each time a flow fires.
  - id (uuid PK)
  - flow_id (uuid FK → automation_flows ON DELETE CASCADE)
  - lead_id (uuid, nullable) — the lead that triggered it
  - status (text: 'success', 'failed', 'skipped')
  - run_log (jsonb) — details of what happened
  - created_at (timestamptz)

2. Security
- Enable RLS on both tables.
- Owner-scoped CRUD on automation_flows (authenticated, auth.uid() = user_id).
- Owner-scoped SELECT/INSERT on automation_runs via flow ownership check.
*/

CREATE TABLE IF NOT EXISTS automation_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE automation_flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_flows" ON automation_flows;
CREATE POLICY "select_own_flows" ON automation_flows FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_flows" ON automation_flows;
CREATE POLICY "insert_own_flows" ON automation_flows FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_flows" ON automation_flows;
CREATE POLICY "update_own_flows" ON automation_flows FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_flows" ON automation_flows;
CREATE POLICY "delete_own_flows" ON automation_flows FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
  lead_id uuid,
  status text NOT NULL DEFAULT 'success',
  run_log jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_runs" ON automation_runs;
CREATE POLICY "select_own_runs" ON automation_runs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_runs.flow_id AND automation_flows.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_runs" ON automation_runs;
CREATE POLICY "insert_own_runs" ON automation_runs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_runs.flow_id AND automation_flows.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_automation_flows_user ON automation_flows(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_flow ON automation_runs(flow_id);
