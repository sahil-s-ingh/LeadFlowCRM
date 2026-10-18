/*
# WhatsApp Chatbot Rules — keyword auto-replies with interactive buttons

1. New Tables
- `wa_chatbot_rules` — one row per rule owned by an admin account
  - `id` uuid PK
  - `user_id` uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
  - `name` text NOT NULL — human label for the rule (e.g. "Pricing reply")
  - `keywords` text[] NOT NULL DEFAULT '{}' — trigger words (case-insensitive, whole-word match)
  - `match_mode` text NOT NULL DEFAULT 'any' CHECK (match_mode IN ('any','exact','starts_with'))
  - `reply_type` text NOT NULL DEFAULT 'text' CHECK (reply_type IN ('text','buttons','list'))
  - `reply_text` text — body text for the reply
  - `buttons` jsonb — array of {id,title} for reply_type='buttons' (max 3)
  - `list_title` text — header for list messages
  - `list_options` jsonb — array of {id,title,description} for reply_type='list'
  - `is_active` boolean NOT NULL DEFAULT true
  - `priority` int NOT NULL DEFAULT 0 — higher priority evaluated first
  - `hit_count` int NOT NULL DEFAULT 0 — incremented each time the rule fires
  - `created_at` timestamptz DEFAULT now()
  - `updated_at` timestamptz DEFAULT now()

- `wa_chatbot_logs` — one row per chatbot reply sent (for analytics / audit)
  - `id` uuid PK
  - `user_id` uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
  - `rule_id` uuid REFERENCES wa_chatbot_rules(id) ON DELETE SET NULL
  - `conversation_id` uuid REFERENCES wa_conversations(id) ON DELETE CASCADE
  - `trigger_message` text — the inbound message that triggered the reply
  - `matched_keyword` text — which keyword matched
  - `reply_type` text
  - `created_at` timestamptz DEFAULT now()

2. Indexes
- idx_wa_chatbot_rules_user_active ON wa_chatbot_rules(user_id, is_active, priority DESC)
- idx_wa_chatbot_logs_user_created ON wa_chatbot_logs(user_id, created_at DESC)
- idx_wa_chatbot_logs_rule ON wa_chatbot_logs(rule_id)

3. Security
- RLS enabled on both tables.
- Owner-scoped CRUD: admin can only manage/view their own rules and logs.
- Logs are inserted by the webhook using the service role key (bypasses RLS), so
  the INSERT policy is provided for client-side convenience but the webhook path
  is the primary writer.
*/

CREATE TABLE IF NOT EXISTS wa_chatbot_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  match_mode text NOT NULL DEFAULT 'any' CHECK (match_mode IN ('any','exact','starts_with')),
  reply_type text NOT NULL DEFAULT 'text' CHECK (reply_type IN ('text','buttons','list')),
  reply_text text,
  buttons jsonb,
  list_title text,
  list_options jsonb,
  is_active boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0,
  hit_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wa_chatbot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES wa_chatbot_rules(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES wa_conversations(id) ON DELETE CASCADE,
  trigger_message text,
  matched_keyword text,
  reply_type text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_chatbot_rules_user_active ON wa_chatbot_rules(user_id, is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_wa_chatbot_logs_user_created ON wa_chatbot_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_chatbot_logs_rule ON wa_chatbot_logs(rule_id);

ALTER TABLE wa_chatbot_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_chatbot_logs ENABLE ROW LEVEL SECURITY;

-- wa_chatbot_rules: owner-scoped CRUD
DROP POLICY IF EXISTS "select_own_wa_chatbot_rules" ON wa_chatbot_rules;
CREATE POLICY "select_own_wa_chatbot_rules" ON wa_chatbot_rules FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_chatbot_rules" ON wa_chatbot_rules;
CREATE POLICY "insert_own_wa_chatbot_rules" ON wa_chatbot_rules FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wa_chatbot_rules" ON wa_chatbot_rules;
CREATE POLICY "update_own_wa_chatbot_rules" ON wa_chatbot_rules FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wa_chatbot_rules" ON wa_chatbot_rules;
CREATE POLICY "delete_own_wa_chatbot_rules" ON wa_chatbot_rules FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- wa_chatbot_logs: owner-scoped read; inserts come from the webhook (service role)
DROP POLICY IF EXISTS "select_own_wa_chatbot_logs" ON wa_chatbot_logs;
CREATE POLICY "select_own_wa_chatbot_logs" ON wa_chatbot_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_chatbot_logs" ON wa_chatbot_logs;
CREATE POLICY "insert_own_wa_chatbot_logs" ON wa_chatbot_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wa_chatbot_logs" ON wa_chatbot_logs;
CREATE POLICY "delete_own_wa_chatbot_logs" ON wa_chatbot_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
