/*
# Multi-Workspace Support — Part 4: Update RLS policies to use workspace_id

## Purpose
Replace all existing user_id-based RLS policies with workspace_id-based policies.
A user can access rows where workspace_id belongs to a workspace they own.

## Security
- authenticated users can only access rows in workspaces they own
- anon can insert into submissions (for public forms)
- anon can read popup_forms, short_links, landing_page_appearance, telegram_settings
*/

DO $$
DECLARE
  t record;
  pol record;
  prefix text;
BEGIN
  FOR t IN 
    SELECT table_name FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name = 'workspace_id'
    AND table_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
    AND table_name NOT IN ('workspaces')
  LOOP
    prefix := t.table_name;
    
    -- Drop ALL existing policies on this table
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = t.table_name AND schemaname = 'public' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t.table_name);
    END LOOP;
    
    -- Create workspace-based policies using quote_ident for policy names
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()))',
      prefix || '_ws_select', t.table_name
    );
    
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()))',
      prefix || '_ws_insert', t.table_name
    );
    
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())) WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()))',
      prefix || '_ws_update', t.table_name
    );
    
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()))',
      prefix || '_ws_delete', t.table_name
    );
  END LOOP;
END $$;

-- Special anon policies for public-facing features
DROP POLICY IF EXISTS "submissions_anon_insert" ON submissions;
CREATE POLICY "submissions_anon_insert"
ON submissions FOR INSERT TO anon
WITH CHECK (workspace_id IN (SELECT id FROM workspaces));

DROP POLICY IF EXISTS "popup_forms_anon_select" ON popup_forms;
CREATE POLICY "popup_forms_anon_select"
ON popup_forms FOR SELECT TO anon
USING (true);

DROP POLICY IF EXISTS "short_links_anon_select" ON short_links;
CREATE POLICY "short_links_anon_select"
ON short_links FOR SELECT TO anon
USING (true);

DROP POLICY IF EXISTS "landing_page_appearance_anon_select" ON landing_page_appearance;
CREATE POLICY "landing_page_appearance_anon_select"
ON landing_page_appearance FOR SELECT TO anon
USING (true);

DROP POLICY IF EXISTS "telegram_settings_anon_select" ON telegram_settings;
CREATE POLICY "telegram_settings_anon_select"
ON telegram_settings FOR SELECT TO anon
USING (true);

DROP POLICY IF EXISTS "short_links_anon_update" ON short_links;
CREATE POLICY "short_links_anon_update"
ON short_links FOR UPDATE TO anon
USING (true) WITH CHECK (true);
