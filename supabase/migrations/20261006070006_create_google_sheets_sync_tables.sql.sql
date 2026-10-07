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
  Expected shape: { "full_name": "Column A header", "mobile_number": "Column B header", "email": "...", "state": "...", "trading_product": "...", "fund_amount": "...", "notes": "..." }
- `trading_product_default` (text, default 'algo') — used when no trading_product column is mapped
- `source_tag` (text, default 'Google Sheets') — tag appended to imported leads
- `is_active` (boolean, default true) — toggle to enable/disable sync
- `last_synced_at` (timestamptz) — timestamp of last successful sync
- `last_row_count` (integer, default 0) — number of rows processed in last sync
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `google_sheets_sync_log`
Audit log for each sync run — success, duplicate, or failure per row.
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
- `google_sheets_sync_log`: authenticated SELECT only (owner), INSERT via service role from edge function.
- The edge function uses the service role key and bypasses RLS for inserts into submissions and sync_log.

## Notes
1. The sync edge function fetches the published CSV URL, parses rows, applies column mapping,
   deduplicates by email/phone (same logic as inbound-webhook), and inserts new leads.
2. A cron job triggers the sync edge function every 5 minutes for active sheets.
3. Users can also trigger a manual sync from the CRM settings UI.
4. The Google Sheet must be published (File > Share > Publish to Web > CSV) for the sync to work
   without requiring Google API credentials.
*/