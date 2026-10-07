/*
# Google Sheets Lead Sync — Settings and Sync Log Tables

## Purpose
Allows CRM users to connect a published Google Sheet and automatically import
new rows as leads into the `submissions` table (the Lead Centre). The sync runs
on a schedule via a cron-triggered edge function and also supports manual sync.

## New Tables

### `google_sheets_settings`
Stores the connection configuration for a Google Sheet import source.
- `id` (uuid, PK)
- `user_id` (uuid, owner, defaults to auth.uid())
- `sheet_url` (text) — the published CSV export URL of the Google Sheet
- `sheet_name` (text, optional) — a friendly label for the sheet
- `column_mapping` (jsonb) — maps sheet column headers to lead fields
- `trading_product_default` (text, default 'algo') — used when no trading_product column is mapped
- `source_tag` (text, default 'Google Sheets') — tag appended to imported leads
- `is_active` (boolean, default true) — toggle to enable/disable sync
- `last_synced_at` (timestamptz) — timestamp of last successful sync
- `last_row_count` (integer, default 0) — number of rows processed in last sync
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `google_sheets_sync_log`
Audit log for each sync run.
- `id` (uuid, PK)
- `settings_id` (uuid, FK to google_sheets_settings, ON DELETE CASCADE)
- `user_id` (uuid, owner)
- `row_data` (jsonb) — the raw row data from the sheet
- `lead_id` (uuid, nullable) — the created lead ID, if successful
- `status` (text) — 'success' | 'duplicate' | 'failed'
- `error_message` (text, nullable)
- `row_number` (integer) — the row index in the sheet
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on both tables.
- `google_sheets_settings`: owner-scoped CRUD (authenticated, auth.uid() = user_id).
- `google_sheets_sync_log`: authenticated SELECT (owner), INSERT via service role from edge function.
*/

CREATE TABLE IF NOT EXISTS google_sheets_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sheet_url text NOT NULL,
  sheet_name text DEFAULT '',
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  trading_product_default text NOT NULL DEFAULT 'algo',
  source_tag text NOT NULL DEFAULT 'Google Sheets',
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_row_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_sheets_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sheets_settings" ON google_sheets_settings;
CREATE POLICY "select_own_sheets_settings"
ON google_sheets_settings FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sheets_settings" ON google_sheets_settings;
CREATE POLICY "insert_own_sheets_settings"
ON google_sheets_settings FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sheets_settings" ON google_sheets_settings;
CREATE POLICY "update_own_sheets_settings"
ON google_sheets_settings FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sheets_settings" ON google_sheets_settings;
CREATE POLICY "delete_own_sheets_settings"
ON google_sheets_settings FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS google_sheets_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_id uuid NOT NULL REFERENCES google_sheets_settings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  row_data jsonb,
  lead_id uuid,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  row_number integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_sheets_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sheets_sync_log" ON google_sheets_sync_log;
CREATE POLICY "select_own_sheets_sync_log"
ON google_sheets_sync_log FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sheets_sync_log" ON google_sheets_sync_log;
CREATE POLICY "insert_own_sheets_sync_log"
ON google_sheets_sync_log FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_google_sheets_settings_user ON google_sheets_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_google_sheets_sync_log_settings ON google_sheets_sync_log(settings_id);
CREATE INDEX IF NOT EXISTS idx_google_sheets_sync_log_created ON google_sheets_sync_log(created_at DESC);