/*
# Add API key system for Google Sheets inbound contact sync

## Changes
1. New Table: `google_sheets_api_keys`
   - Stores hashed API keys that external Google Apps Scripts use to authenticate when pushing contacts into the CRM.
   - `key_hash` stores a SHA-256 hash of the plaintext key (plaintext is only shown once at generation time).
   - `user_id` links to the CRM account owner.
   - `name` is a user-friendly label for the key.
   - `is_active` allows revoking a key without deleting it.
   - `last_used_at` tracks when the key was last used for an import.

2. RLS on `google_sheets_api_keys`
   - Owner-scoped CRUD (authenticated users manage their own keys only).
*/

CREATE TABLE IF NOT EXISTS google_sheets_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gs_api_keys_user ON google_sheets_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_gs_api_keys_hash ON google_sheets_api_keys(key_hash);

ALTER TABLE google_sheets_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_gs_api_keys" ON google_sheets_api_keys;
CREATE POLICY "select_own_gs_api_keys" ON google_sheets_api_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_gs_api_keys" ON google_sheets_api_keys;
CREATE POLICY "insert_own_gs_api_keys" ON google_sheets_api_keys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_gs_api_keys" ON google_sheets_api_keys;
CREATE POLICY "update_own_gs_api_keys" ON google_sheets_api_keys
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_gs_api_keys" ON google_sheets_api_keys;
CREATE POLICY "delete_own_gs_api_keys" ON google_sheets_api_keys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
