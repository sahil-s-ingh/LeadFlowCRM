/*
  # Google Sheets Integration — connection configs and sync log

  1. New Tables
  - `google_sheets_connections`: per-user connection to a Google Apps Script web app URL.
    Stores the deployed script URL, a friendly name, subscribed events (same event set as
    integration_webhooks), is_active toggle, column mapping (which lead fields map to which
    sheet columns), last sync status/timestamp.
  - `google_sheets_sync_log`: audit trail of every row push attempt — status (synced/failed),
    event type, lead data sent, error message if any.

  2. Security
  - Both tables have RLS enabled with owner-scoped policies (auth.uid() = user_id).
  - user_id defaults to auth.uid() so inserts from authenticated clients work without
    explicitly passing it.

  3. Indexes
  - user index for listing connections
  - connection + created_at for sync log ordering
*/

CREATE TABLE IF NOT EXISTS google_sheets_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  script_url text NOT NULL,
  spreadsheet_id text,
  spreadsheet_name text,
  sheet_name text NOT NULL DEFAULT 'Leads',
  events text[] NOT NULL DEFAULT '{lead_created}',
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_sheets_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_gs_connections" ON google_sheets_connections;
CREATE POLICY "select_own_gs_connections" ON google_sheets_connections FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_gs_connections" ON google_sheets_connections;
CREATE POLICY "insert_own_gs_connections" ON google_sheets_connections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_gs_connections" ON google_sheets_connections;
CREATE POLICY "update_own_gs_connections" ON google_sheets_connections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_gs_connections" ON google_sheets_connections;
CREATE POLICY "delete_own_gs_connections" ON google_sheets_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gs_connections_user ON google_sheets_connections(user_id);

CREATE TABLE IF NOT EXISTS google_sheets_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES google_sheets_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,
  lead_id uuid,
  lead_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_sheets_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_gs_sync_log" ON google_sheets_sync_log;
CREATE POLICY "select_own_gs_sync_log" ON google_sheets_sync_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_gs_sync_log" ON google_sheets_sync_log;
CREATE POLICY "insert_own_gs_sync_log" ON google_sheets_sync_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_gs_sync_log" ON google_sheets_sync_log;
CREATE POLICY "update_own_gs_sync_log" ON google_sheets_sync_log
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_gs_sync_log" ON google_sheets_sync_log;
CREATE POLICY "delete_own_gs_sync_log" ON google_sheets_sync_log
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gs_sync_log_connection ON google_sheets_sync_log(connection_id, created_at DESC);