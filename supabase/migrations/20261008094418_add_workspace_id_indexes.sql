/*
# Multi-Workspace Support — Part 5: Add indexes on workspace_id

## Purpose
Add indexes on workspace_id for all data tables to ensure query performance
when filtering by workspace.
*/

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN 
    SELECT table_name FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name = 'workspace_id'
    AND table_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
    AND table_name NOT IN ('workspaces')
  LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workspace_id ON %I (workspace_id)', t.table_name, t.table_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
