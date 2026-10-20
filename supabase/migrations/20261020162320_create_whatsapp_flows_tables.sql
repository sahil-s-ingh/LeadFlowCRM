/*
# WhatsApp Flows API — create/manage in-chat forms via Meta Cloud API

WhatsApp Flows are structured, multi-step forms that open inside a WhatsApp
conversation. This migration stores Flow definitions and their submissions.

Tables:
- wa_flows: one row per Flow created on a WhatsApp business number
  - id (uuid PK)
  - user_id (uuid, owner, defaults to auth.uid())
  - wa_flow_id (text, unique) — Flow ID returned by Meta
  - name (text) — display name
  - categories (text[]) — e.g. ['SURVEY', 'SIGN_UP', 'APPOINTMENT']
  - endpoint_uri (text, nullable) — data exchange endpoint (for dynamic flows)
  - status (text) — draft | published | blocked | outdated
  - flow_json (jsonb) — the full Flow JSON definition (screens, components)
  - wa_settings_id (uuid, nullable) — which WhatsApp number created it
  - created_at, updated_at

- wa_flow_submissions: data submitted by users via a Flow
  - id (uuid PK)
  - flow_id (uuid FK -> wa_flows.id ON DELETE CASCADE)
  - user_id (uuid, owner)
  - wa_phone_number (text) — the phone number that submitted
  - wa_wa_id (text, nullable)
  - submitted_data (jsonb) — the form data
  - raw_payload (jsonb) — the full webhook payload
  - wa_message_id (text, nullable)
  - created_at

RLS — owner-scoped CRUD via auth.uid() = user_id, 4 policies each.
Realtime enabled on both tables.
*/

CREATE TABLE IF NOT EXISTS wa_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  wa_flow_id text UNIQUE,
  name text NOT NULL,
  categories text[] NOT NULL DEFAULT '{}',
  endpoint_uri text,
  status text NOT NULL DEFAULT 'draft',
  flow_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  wa_settings_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wa_flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_flows" ON wa_flows;
CREATE POLICY "select_own_wa_flows" ON wa_flows FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_flows" ON wa_flows;
CREATE POLICY "insert_own_wa_flows" ON wa_flows FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wa_flows" ON wa_flows;
CREATE POLICY "update_own_wa_flows" ON wa_flows FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wa_flows" ON wa_flows;
CREATE POLICY "delete_own_wa_flows" ON wa_flows FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS wa_flow_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES wa_flows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  wa_phone_number text,
  wa_wa_id text,
  submitted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload jsonb,
  wa_message_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wa_flow_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_flow_submissions" ON wa_flow_submissions;
CREATE POLICY "select_own_wa_flow_submissions" ON wa_flow_submissions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_flow_submissions" ON wa_flow_submissions;
CREATE POLICY "insert_own_wa_flow_submissions" ON wa_flow_submissions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wa_flow_submissions" ON wa_flow_submissions;
CREATE POLICY "update_own_wa_flow_submissions" ON wa_flow_submissions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wa_flow_submissions" ON wa_flow_submissions;
CREATE POLICY "delete_own_wa_flow_submissions" ON wa_flow_submissions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_flows_user ON wa_flows(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_flows_settings ON wa_flows(wa_settings_id);
CREATE INDEX IF NOT EXISTS idx_wa_flow_submissions_flow ON wa_flow_submissions(flow_id);
CREATE INDEX IF NOT EXISTS idx_wa_flow_submissions_user ON wa_flow_submissions(user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE wa_flows;
ALTER PUBLICATION supabase_realtime ADD TABLE wa_flow_submissions;