/*
# Create WhatsApp Message Templates table

1. New Tables
- `wa_message_templates`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `meta_template_id` (text, nullable) — the ID returned by Meta after creating a template
  - `name` (text, not null) — template name (lowercase, underscores)
  - `language` (text, not null) — e.g. en_US, en
  - `category` (text, not null) — UTILITY, MARKETING, or AUTHENTICATION
  - `status` (text, not null, default 'PENDING') — PENDING, APPROVED, REJECTED
  - `components` (jsonb, not null) — the full components array sent to / stored from Meta
  - `rejection_reason` (text, nullable) — populated if Meta rejects the template
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
  - UNIQUE constraint on (user_id, name, language)

2. Security
- Enable RLS on `wa_message_templates`.
- Owner-scoped CRUD: each authenticated user can only access rows they own.
- 4 separate policies (select/insert/update/delete), scoped TO authenticated.

3. Notes
- This table caches templates locally so the panel can show status without polling Meta every time.
- The edge function syncs status from Meta and updates rows here.
*/

CREATE TABLE IF NOT EXISTS wa_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_template_id text,
  name text NOT NULL,
  language text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name, language)
);

ALTER TABLE wa_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_message_templates" ON wa_message_templates;
CREATE POLICY "select_own_wa_message_templates" ON wa_message_templates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_message_templates" ON wa_message_templates;
CREATE POLICY "insert_own_wa_message_templates" ON wa_message_templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wa_message_templates" ON wa_message_templates;
CREATE POLICY "update_own_wa_message_templates" ON wa_message_templates FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wa_message_templates" ON wa_message_templates;
CREATE POLICY "delete_own_wa_message_templates" ON wa_message_templates FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_message_templates_user ON wa_message_templates(user_id, created_at DESC);
