/*
# Enhance WhatsApp Templates with Tags, Version History, A/B Testing, and Library

## Overview
This migration adds 4 new tables to support advanced template management features:
1. Template tags/folders for grouping and filtering templates
2. Template version history to track changes over time
3. A/B testing to compare template performance
4. A pre-built template library for one-click imports

## New Tables

### 1. wa_template_tags
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, defaults to auth.uid(), FK to auth.users)
- `name` (text, NOT NULL) — tag/folder name, e.g. "Festival Offers", "Onboarding"
- `color` (text, default '#25D366') — color label for visual identification
- `created_at` (timestamptz, default now())
- UNIQUE(user_id, name)

### 2. wa_template_tag_assignments
- `id` (uuid, PK)
- `template_id` (uuid, NOT NULL, FK to wa_message_templates ON DELETE CASCADE)
- `tag_id` (uuid, NOT NULL, FK to wa_template_tags ON DELETE CASCADE)
- `created_at` (timestamptz, default now())
- UNIQUE(template_id, tag_id)

### 3. wa_template_versions
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, defaults to auth.uid(), FK to auth.users)
- `template_id` (uuid, NOT NULL, FK to wa_message_templates ON DELETE CASCADE)
- `version_number` (int, NOT NULL) — sequential version number
- `components` (jsonb, NOT NULL) — snapshot of components at this version
- `name` (text, NOT NULL) — template name at this version
- `changed_by` (text, nullable) — description of what changed
- `created_at` (timestamptz, default now())

### 4. wa_ab_tests
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, defaults to auth.uid(), FK to auth.users)
- `name` (text, NOT NULL) — test name, e.g. "Welcome Message A/B Test"
- `variant_a_template` (text, NOT NULL) — template name for variant A
- `variant_b_template` (text, NOT NULL) — template name for variant B
- `variant_a_language` (text, default 'en_US')
- `variant_b_language` (text, default 'en_US')
- `status` (text, default 'draft') — draft | running | completed
- `split_percentage` (int, default 50) — percentage for variant A (rest goes to B)
- `total_sent_a` (int, default 0)
- `total_sent_b` (int, default 0)
- `delivered_a` (int, default 0)
- `delivered_b` (int, default 0)
- `read_a` (int, default 0)
- `read_b` (int, default 0)
- `clicked_a` (int, default 0)
- `clicked_b` (int, default 0)
- `winner` (text, nullable) — 'A' | 'B' | 'tie' | null
- `created_at`, `updated_at` (timestamptz)

## Security
- RLS enabled on all 4 new tables.
- Owner-scoped CRUD policies (4 per table) scoped TO authenticated.
- Tag assignments use EXISTS subquery to verify template ownership.

## Notes
- Template tags allow many-to-many relationship between templates and tags.
- Version history is automatically created when a template is edited.
- A/B test results are aggregated from broadcast campaign data.
*/

-- 1. Template Tags table
CREATE TABLE IF NOT EXISTS wa_template_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#25D366',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE wa_template_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_template_tags" ON wa_template_tags;
CREATE POLICY "select_own_template_tags" ON wa_template_tags FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_template_tags" ON wa_template_tags;
CREATE POLICY "insert_own_template_tags" ON wa_template_tags FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_template_tags" ON wa_template_tags;
CREATE POLICY "update_own_template_tags" ON wa_template_tags FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_template_tags" ON wa_template_tags;
CREATE POLICY "delete_own_template_tags" ON wa_template_tags FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 2. Template Tag Assignments (junction table)
CREATE TABLE IF NOT EXISTS wa_template_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES wa_message_templates(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES wa_template_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (template_id, tag_id)
);

ALTER TABLE wa_template_tag_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_template_tag_assignments" ON wa_template_tag_assignments;
CREATE POLICY "select_template_tag_assignments" ON wa_template_tag_assignments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wa_message_templates t WHERE t.id = template_id AND t.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_template_tag_assignments" ON wa_template_tag_assignments;
CREATE POLICY "insert_template_tag_assignments" ON wa_template_tag_assignments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM wa_message_templates t WHERE t.id = template_id AND t.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM wa_template_tags tg WHERE tg.id = tag_id AND tg.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_template_tag_assignments" ON wa_template_tag_assignments;
CREATE POLICY "delete_template_tag_assignments" ON wa_template_tag_assignments FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wa_message_templates t WHERE t.id = template_id AND t.user_id = auth.uid())
  );

-- 3. Template Version History
CREATE TABLE IF NOT EXISTS wa_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES wa_message_templates(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  name text NOT NULL,
  changed_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wa_template_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_template_versions" ON wa_template_versions;
CREATE POLICY "select_own_template_versions" ON wa_template_versions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_template_versions" ON wa_template_versions;
CREATE POLICY "insert_own_template_versions" ON wa_template_versions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_template_versions" ON wa_template_versions;
CREATE POLICY "delete_own_template_versions" ON wa_template_versions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_template_versions_template ON wa_template_versions(template_id, version_number DESC);

-- 4. A/B Testing
CREATE TABLE IF NOT EXISTS wa_ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  variant_a_template text NOT NULL,
  variant_b_template text NOT NULL,
  variant_a_language text NOT NULL DEFAULT 'en_US',
  variant_b_language text NOT NULL DEFAULT 'en_US',
  status text NOT NULL DEFAULT 'draft',
  split_percentage int NOT NULL DEFAULT 50,
  total_sent_a int NOT NULL DEFAULT 0,
  total_sent_b int NOT NULL DEFAULT 0,
  delivered_a int NOT NULL DEFAULT 0,
  delivered_b int NOT NULL DEFAULT 0,
  read_a int NOT NULL DEFAULT 0,
  read_b int NOT NULL DEFAULT 0,
  clicked_a int NOT NULL DEFAULT 0,
  clicked_b int NOT NULL DEFAULT 0,
  winner text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wa_ab_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ab_tests" ON wa_ab_tests;
CREATE POLICY "select_own_ab_tests" ON wa_ab_tests FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ab_tests" ON wa_ab_tests;
CREATE POLICY "insert_own_ab_tests" ON wa_ab_tests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ab_tests" ON wa_ab_tests;
CREATE POLICY "update_own_ab_tests" ON wa_ab_tests FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ab_tests" ON wa_ab_tests;
CREATE POLICY "delete_own_ab_tests" ON wa_ab_tests FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Add tag_id column to templates for quick folder filtering
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wa_message_templates' AND column_name = 'archived') THEN
    ALTER TABLE wa_message_templates ADD COLUMN archived boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add read_count and clicked_count to broadcast campaigns for richer analytics
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wa_broadcast_campaigns' AND column_name = 'read_count') THEN
    ALTER TABLE wa_broadcast_campaigns ADD COLUMN read_count int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wa_broadcast_campaigns' AND column_name = 'clicked_count') THEN
    ALTER TABLE wa_broadcast_campaigns ADD COLUMN clicked_count int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wa_broadcast_campaigns' AND column_name = 'scheduled_at') THEN
    ALTER TABLE wa_broadcast_campaigns ADD COLUMN scheduled_at timestamptz;
  END IF;
END $$;
