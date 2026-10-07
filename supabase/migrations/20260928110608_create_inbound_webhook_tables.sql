/*
# Create Inbound Webhook Tables

1. New Tables
- `inbound_webhook_keys` — stores per-user API keys for inbound lead ingestion.
  Each user can have multiple API keys, each with a label (e.g. "Zapier", "Typeform") and an optional source tag.
  Columns: id, user_id, api_key (unique, indexed), label, source_tag, is_active, created_at, updated_at.
- `inbound_webhook_logs` — logs every inbound webhook request for audit/debugging.
  Columns: id, api_key_id, lead_id (nullable, set if a lead was created), raw_payload (jsonb), source, status (success/failed/duplicate), error_message, created_at.

2. Security
- Enable RLS on both tables.
- inbound_webhook_keys: owner-scoped CRUD (authenticated, auth.uid() = user_id).
- inbound_webhook_logs: owner-scoped SELECT only (authenticated, auth.uid() matches via api_key_id → inbound_webhook_keys.user_id).
  INSERT is done by the edge function using the service role key (bypasses RLS), so no INSERT policy needed for authenticated.
- No UPDATE or DELETE policies on inbound_webhook_logs (immutable audit log).

3. Notes
- The api_key column is a text field storing a random secure token (generated client-side, stored hashed would be ideal but for simplicity stored as-is — the key IS the secret).
- The edge function `inbound-webhook` will be public (verify_jwt = false) so external systems can POST to it without a Supabase session.
- Authentication is via the api_key query parameter: `?key=abc123...`.
*/

CREATE TABLE IF NOT EXISTS inbound_webhook_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key text UNIQUE NOT NULL,
  label text NOT NULL DEFAULT 'Inbound Webhook',
  source_tag text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_webhook_keys_api_key ON inbound_webhook_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_inbound_webhook_keys_user_id ON inbound_webhook_keys(user_id);

ALTER TABLE inbound_webhook_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_inbound_keys" ON inbound_webhook_keys;
CREATE POLICY "select_own_inbound_keys" ON inbound_webhook_keys FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_inbound_keys" ON inbound_webhook_keys;
CREATE POLICY "insert_own_inbound_keys" ON inbound_webhook_keys FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_inbound_keys" ON inbound_webhook_keys;
CREATE POLICY "update_own_inbound_keys" ON inbound_webhook_keys FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_inbound_keys" ON inbound_webhook_keys;
CREATE POLICY "delete_own_inbound_keys" ON inbound_webhook_keys FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS inbound_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES inbound_webhook_keys(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  raw_payload jsonb,
  source text,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_webhook_logs_api_key_id ON inbound_webhook_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_inbound_webhook_logs_created_at ON inbound_webhook_logs(created_at DESC);

ALTER TABLE inbound_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_inbound_logs" ON inbound_webhook_logs;
CREATE POLICY "select_own_inbound_logs" ON inbound_webhook_logs FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM inbound_webhook_keys
      WHERE inbound_webhook_keys.id = inbound_webhook_logs.api_key_id
      AND inbound_webhook_keys.user_id = auth.uid()
    )
  );
