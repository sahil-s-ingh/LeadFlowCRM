/*
# Create Integration Hub — outbound webhooks for Pabbly/Make.com/Zapier

1. New Tables
- `integration_webhooks`: user-defined webhook endpoints that receive event payloads
  when lead events fire (new lead, status change, conversion, assignment, note added).
  Each webhook has a name, destination URL, subscribed events, is_active toggle, and
  a secret token used to sign outbound payloads (HMAC-SHA256 in X-Webhook-Signature header).
- `integration_webhook_deliveries`: audit log of every delivery attempt — status
  (delivered/failed/retrying), HTTP response code, response body snippet, attempt count,
  and next_retry_at for exponential backoff.

2. Security
- Both tables have RLS enabled with owner-scoped policies (auth.uid() = user_id).
- `integration_webhooks.user_id` defaults to auth.uid() so inserts omitting it succeed.
- `integration_webhook_deliveries` is scoped through the parent webhook's user_id.

3. Indexes
- `idx_integration_webhooks_user` on (user_id) for listing user's webhooks.
- `idx_integration_webhook_deliveries_webhook` on (webhook_id, created_at desc) for event log.
- `idx_integration_webhook_deliveries_status` on (status) for retry queue filtering.
*/

CREATE TABLE IF NOT EXISTS integration_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  secret_token text NOT NULL DEFAULT gen_random_uuid(),
  events text[] NOT NULL DEFAULT '{lead_created}',
  is_active boolean NOT NULL DEFAULT true,
  last_delivery_at timestamptz,
  last_delivery_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE integration_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_webhooks" ON integration_webhooks;
CREATE POLICY "select_own_webhooks" ON integration_webhooks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_webhooks" ON integration_webhooks;
CREATE POLICY "insert_own_webhooks" ON integration_webhooks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_webhooks" ON integration_webhooks;
CREATE POLICY "update_own_webhooks" ON integration_webhooks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_webhooks" ON integration_webhooks;
CREATE POLICY "delete_own_webhooks" ON integration_webhooks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_integration_webhooks_user ON integration_webhooks(user_id);

CREATE TABLE IF NOT EXISTS integration_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES integration_webhooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  response_code integer,
  response_body text,
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE integration_webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_deliveries" ON integration_webhook_deliveries;
CREATE POLICY "select_own_deliveries" ON integration_webhook_deliveries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_deliveries" ON integration_webhook_deliveries;
CREATE POLICY "insert_own_deliveries" ON integration_webhook_deliveries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_deliveries" ON integration_webhook_deliveries;
CREATE POLICY "update_own_deliveries" ON integration_webhook_deliveries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_deliveries" ON integration_webhook_deliveries;
CREATE POLICY "delete_own_deliveries" ON integration_webhook_deliveries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_integration_webhook_deliveries_webhook
  ON integration_webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_deliveries_status
  ON integration_webhook_deliveries(status) WHERE status IN ('pending', 'retrying');
