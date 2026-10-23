/*
# Enhance AI Knowledge Base + Create Reply Logs Table

## Changes to ai_knowledge_base:
- Add `priority` (integer, default 0) — higher priority entries are injected first
- Add `expires_at` (timestamptz, nullable) — entries past this date are auto-excluded
- Add `language` (text, default 'en') — language code for multi-language support

## New Tables:
- `ai_reply_logs` — tracks every AI reply sent, with metadata for analytics
  - id, user_id, platform, conversation_id, incoming_text, reply_text,
    used_kb (boolean), kb_entry_titles (text[]), language, sentiment,
    confidence (text), created_at

## Security:
- RLS enabled on ai_reply_logs, owner-scoped to authenticated users
- Grants on both tables for authenticated CRUD
*/

-- Add columns to ai_knowledge_base
ALTER TABLE ai_knowledge_base
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

-- Create ai_reply_logs table
CREATE TABLE IF NOT EXISTS ai_reply_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  conversation_id text,
  incoming_text text,
  reply_text text,
  used_kb boolean NOT NULL DEFAULT false,
  kb_entry_titles text[] NOT NULL DEFAULT '{}',
  language text,
  sentiment text,
  confidence text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_reply_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_reply_logs TO authenticated;

DROP POLICY IF EXISTS "select_own_reply_logs" ON ai_reply_logs;
CREATE POLICY "select_own_reply_logs" ON ai_reply_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reply_logs" ON ai_reply_logs;
CREATE POLICY "insert_own_reply_logs" ON ai_reply_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reply_logs" ON ai_reply_logs;
CREATE POLICY "update_own_reply_logs" ON ai_reply_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reply_logs" ON ai_reply_logs;
CREATE POLICY "delete_own_reply_logs" ON ai_reply_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reply_logs_user_id ON ai_reply_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_reply_logs_created ON ai_reply_logs(user_id, created_at DESC);

-- Grant service_role access to ai_reply_logs (edge function inserts logs)
GRANT INSERT ON ai_reply_logs TO service_role;
GRANT SELECT ON ai_reply_logs TO service_role;
