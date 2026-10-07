/*
# Create Webhook Integration Tables

1. New Tables
- `webhooks`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to authenticated user, references auth.users)
  - `url` (text, not null) — destination URL to POST to
  - `label` (text) — friendly name for the webhook
  - `secret_token` (text) — optional secret sent as X-Webhook-Token header for verification
  - `events` (text[], not null) — which events trigger this webhook (e.g. lead.created, lead.updated, lead.deleted, lead.status_changed)
  - `is_active` (boolean, default true) — whether the webhook is enabled
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

- `webhook_deliveries`
  - `id` (uuid, primary key)
  - `webhook_id` (uuid, references webhooks ON DELETE CASCADE)
  - `user_id` (uuid, not null, defaults to authenticated user, references auth.users)
  - `event` (text, not null) — the event that triggered this delivery
  - `payload` (jsonb) — the data sent
  - `status` (text) — 'pending' | 'success' | 'failed'
  - `response_status` (integer) — HTTP status code returned
  - `response_body` (text) — truncated response body
  - `attempts` (integer, default 1)
  - `created_at` (timestamptz, default now)

2. Security
- Enable RLS on both tables.
- Owner-scoped CRUD: each authenticated user can only access their own webhooks and delivery logs.
- 4 separate policies per table: SELECT, INSERT, UPDATE, DELETE.
- `user_id` defaults to `auth.uid()` so inserts that omit it still satisfy WITH CHECK.
*/

CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text DEFAULT '',
  secret_token text DEFAULT '',
  events text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_webhooks" ON webhooks;
CREATE POLICY "select_own_webhooks" ON webhooks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_webhooks" ON webhooks;
CREATE POLICY "insert_own_webhooks" ON webhooks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_webhooks" ON webhooks;
CREATE POLICY "update_own_webhooks" ON webhooks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_webhooks" ON webhooks;
CREATE POLICY "delete_own_webhooks" ON webhooks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid REFERENCES webhooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  response_status integer,
  response_body text,
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_webhook_deliveries" ON webhook_deliveries;
CREATE POLICY "select_own_webhook_deliveries" ON webhook_deliveries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_webhook_deliveries" ON webhook_deliveries;
CREATE POLICY "insert_own_webhook_deliveries" ON webhook_deliveries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_webhook_deliveries" ON webhook_deliveries;
CREATE POLICY "update_own_webhook_deliveries" ON webhook_deliveries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_webhook_deliveries" ON webhook_deliveries;
CREATE POLICY "delete_own_webhook_deliveries" ON webhook_deliveries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_user_id ON webhook_deliveries(user_id);
