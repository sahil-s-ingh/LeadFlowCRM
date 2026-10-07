/*
# Add Automation Queue Table for Delayed Actions

1. New Tables
- `automation_queue`: Stores delayed automation steps that need to execute at a future time.
  - id (uuid PK)
  - flow_id (uuid FK → automation_flows ON DELETE CASCADE)
  - lead_id (uuid, nullable) — the lead context
  - run_id (uuid, nullable) — the automation_runs entry this belongs to
  - actions (jsonb) — remaining actions to execute after the delay
  - context (jsonb) — lead_data, message_data, etc. preserved for delayed execution
  - execute_at (timestamptz) — when to run the remaining actions
  - status (text: 'pending', 'completed', 'failed') default 'pending'
  - created_at (timestamptz default now())

2. Security
- Enable RLS on automation_queue.
- Owner-scoped SELECT/INSERT/UPDATE via flow ownership check (same pattern as automation_runs).

3. Index
- Index on (status, execute_at) for efficient queue polling.
*/

CREATE TABLE IF NOT EXISTS automation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
  lead_id uuid,
  run_id uuid,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb DEFAULT '{}'::jsonb,
  execute_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE automation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_queue" ON automation_queue;
CREATE POLICY "select_own_queue" ON automation_queue FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_queue.flow_id AND automation_flows.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_queue" ON automation_queue;
CREATE POLICY "insert_own_queue" ON automation_queue FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_queue.flow_id AND automation_flows.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_queue" ON automation_queue;
CREATE POLICY "update_own_queue" ON automation_queue FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_queue.flow_id AND automation_flows.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM automation_flows WHERE automation_flows.id = automation_queue.flow_id AND automation_flows.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_automation_queue_status_time ON automation_queue(status, execute_at);
