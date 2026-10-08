/*
# Multi-Workspace Support — Part 1: workspaces table + helper functions

## Purpose
Create the workspaces table and helper functions for the multi-workspace feature.
Each workspace is an isolated CRM instance owned by a user.

## New Tables
- `workspaces`: id, owner_id (FK auth.users), name, description, created_at

## New Functions
- `user_workspace_ids()`: returns set of workspace IDs owned by current user
- `ensure_default_workspace(p_user_id)`: creates "Default Workspace" if none exists, returns its ID

## Security
- RLS on workspaces: owner can CRUD their own workspaces
- Functions are SECURITY DEFINER, execute granted to authenticated
*/

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default Workspace',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspaces_owner_select" ON workspaces;
CREATE POLICY "workspaces_owner_select"
ON workspaces FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "workspaces_owner_insert" ON workspaces;
CREATE POLICY "workspaces_owner_insert"
ON workspaces FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "workspaces_owner_update" ON workspaces;
CREATE POLICY "workspaces_owner_update"
ON workspaces FOR UPDATE TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "workspaces_owner_delete" ON workspaces;
CREATE POLICY "workspaces_owner_delete"
ON workspaces FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- Also allow anon to read workspaces (needed for public form to find platform owner's workspace)
DROP POLICY IF EXISTS "workspaces_anon_select" ON workspaces;
CREATE POLICY "workspaces_anon_select"
ON workspaces FOR SELECT TO anon
USING (true);

CREATE OR REPLACE FUNCTION public.user_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM workspaces WHERE owner_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.user_workspace_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_workspace_ids() TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_default_workspace(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT id INTO v_workspace_id FROM workspaces WHERE owner_id = p_user_id ORDER BY created_at LIMIT 1;
  IF v_workspace_id IS NULL THEN
    INSERT INTO workspaces (owner_id, name) VALUES (p_user_id, 'Default Workspace')
    RETURNING id INTO v_workspace_id;
  END IF;
  RETURN v_workspace_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_default_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_default_workspace(uuid) TO authenticated;
