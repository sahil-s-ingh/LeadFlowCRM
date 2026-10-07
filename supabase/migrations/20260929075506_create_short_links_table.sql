/*
# Create short_links table for WhatsApp direct link shortener

1. New Tables
- `short_links`
  - `id` (uuid, primary key)
  - `short_code` (text, unique, not null) — the 6-character code used in the short URL
  - `original_url` (text, not null) — the full wa.me link to redirect to
  - `phone_number` (text, nullable) — the phone number used (for reference)
  - `message` (text, nullable) — the pre-filled message (for reference)
  - `clicks` (integer, default 0) — click counter
  - `user_id` (uuid, nullable, references auth.users) — owner of the link
  - `created_at` (timestamptz, default now())
  - `expires_at` (timestamptz, nullable) — optional expiry

2. Security
- Enable RLS on `short_links`.
- SELECT: public (anyone can resolve a short link by code) — TO anon, authenticated
- INSERT: authenticated users can create short links
- UPDATE: owner can update (e.g. clicks increment)
- DELETE: owner can delete their own short links

3. Indexes
- Unique index on `short_code` for fast lookups
- Index on `user_id` for owner queries
*/

CREATE TABLE IF NOT EXISTS short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code text UNIQUE NOT NULL,
  original_url text NOT NULL,
  phone_number text,
  message text,
  clicks integer NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_short_links_code ON short_links(short_code);
CREATE INDEX IF NOT EXISTS idx_short_links_user ON short_links(user_id);

ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can resolve a short link (needed for redirect)
DROP POLICY IF EXISTS "public_read_short_links" ON short_links;
CREATE POLICY "public_read_short_links"
ON short_links FOR SELECT
TO anon, authenticated
USING (true);

-- Authenticated users can create short links
DROP POLICY IF EXISTS "insert_own_short_links" ON short_links;
CREATE POLICY "insert_own_short_links"
ON short_links FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Owner can update (click counter, etc.)
DROP POLICY IF EXISTS "update_own_short_links" ON short_links;
CREATE POLICY "update_own_short_links"
ON short_links FOR UPDATE
TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Owner can delete
DROP POLICY IF EXISTS "delete_own_short_links" ON short_links;
CREATE POLICY "delete_own_short_links"
ON short_links FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
