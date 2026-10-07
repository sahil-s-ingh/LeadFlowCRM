/*
# Create submissions table (single-tenant, no auth)

1. New Tables
- `submissions`
- `id` (uuid, primary key)
- `full_name` (text, not null) — visitor's full name
- `mobile_number` (text, not null) — visitor's mobile/phone number
- `email` (text, not null) — visitor's email address
- `state` (text, not null) — visitor's state (Indian state)
- `trading_product` (text, not null) — chosen product: 'algo' or 'tradingview_premium'
- `created_at` (timestamptz, defaults to now)

2. Security
- Enable RLS on `submissions`.
- Allow anon + authenticated to insert (form submissions from the public landing page).
- No SELECT/UPDATE/DELETE for anon — only inserts are needed from the frontend.
*/

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  mobile_number text NOT NULL,
  email text NOT NULL,
  state text NOT NULL,
  trading_product text NOT NULL CHECK (trading_product IN ('algo', 'tradingview_premium')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_submissions" ON submissions;
CREATE POLICY "anon_insert_submissions"
ON submissions FOR INSERT
TO anon, authenticated
WITH CHECK (true);