/*
# Create email_templates table

1. New Tables
- `email_templates`
  - `id` uuid PK
  - `user_id` uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE
  - `name` text NOT NULL — template name (e.g. "Welcome Email")
  - `subject` text NOT NULL — email subject line
  - `body` text NOT NULL — email body content (plain text or HTML)
  - `category` text NOT NULL DEFAULT 'custom' — 'custom' | 'telegram_join' | 'follow_up' | 'welcome' | 'conversion'
  - `is_prebuilt` boolean NOT NULL DEFAULT false — true for system pre-built templates
  - `is_active` boolean NOT NULL DEFAULT true — soft toggle
  - `created_at` timestamptz DEFAULT now()
  - `updated_at` timestamptz DEFAULT now()
  - UNIQUE(user_id, name)

2. Security
- RLS enabled on email_templates.
- Owner-scoped CRUD: each authenticated user can only access their own templates.
- Pre-built templates are seeded per-user (not shared across users).
*/

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'custom' CHECK (category IN ('custom', 'telegram_join', 'follow_up', 'welcome', 'conversion')),
  is_prebuilt boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_email_templates" ON email_templates;
CREATE POLICY "select_own_email_templates" ON email_templates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_email_templates" ON email_templates;
CREATE POLICY "insert_own_email_templates" ON email_templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_email_templates" ON email_templates;
CREATE POLICY "update_own_email_templates" ON email_templates FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_email_templates" ON email_templates;
CREATE POLICY "delete_own_email_templates" ON email_templates FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_templates_user ON email_templates(user_id, created_at DESC);
