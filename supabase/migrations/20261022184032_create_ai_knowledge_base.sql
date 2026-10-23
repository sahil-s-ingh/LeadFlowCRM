/*
# Create AI Knowledge Base table

1. New Tables
- `ai_knowledge_base` — stores knowledge entries that the AI auto-reply uses to answer customer questions.
  - `id` (uuid, primary key)
  - `user_id` (uuid, owner of the knowledge entry, defaults to auth.uid())
  - `title` (text, short label like "Premium TradingView Indicator")
  - `category` (text, grouping like "Product", "Pricing", "FAQ", "How it works")
  - `content` (text, the detailed knowledge the AI should use when answering)
  - `keywords` (text array, trigger words that help the AI match this entry to a question)
  - `is_active` (boolean, whether this entry is active)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- Enable RLS on `ai_knowledge_base`.
- Grant CRUD to `authenticated` (the CRM requires sign-in).
- Owner-scoped CRUD: each authenticated user can only access their own knowledge entries.
*/

CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Product',
  content text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_knowledge_base TO authenticated;

DROP POLICY IF EXISTS "select_own_kb" ON ai_knowledge_base;
CREATE POLICY "select_own_kb" ON ai_knowledge_base FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_kb" ON ai_knowledge_base;
CREATE POLICY "insert_own_kb" ON ai_knowledge_base FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_kb" ON ai_knowledge_base;
CREATE POLICY "update_own_kb" ON ai_knowledge_base FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_kb" ON ai_knowledge_base;
CREATE POLICY "delete_own_kb" ON ai_knowledge_base FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_kb_user_id ON ai_knowledge_base(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_kb_active ON ai_knowledge_base(user_id, is_active);