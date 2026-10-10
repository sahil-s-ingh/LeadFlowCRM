/*
# Fix Multi-Workspace Creation — Unique Constraint + Owner Backfill

## Problem
The `team_members` table has a `UNIQUE(owner_id, email)` constraint.
When `createWorkspace()` inserts a new owner team member with the same
(owner_id, email) for a different workspace_id, the insert silently fails
due to the unique violation. This means new workspaces have no owner team
member, so role/permission lookups return nothing and the CRM breaks.

## Changes
1. Drop the old `UNIQUE(owner_id, email)` constraint.
2. Add a new `UNIQUE(owner_id, email, workspace_id)` constraint so each
   workspace can have its own owner team member row.
3. Backfill: for every workspace that has no owner team member, create one
   using the workspace owner's email from `auth.users`.

## Security
No new tables. RLS unchanged. Backfill runs as SECURITY DEFINER.
*/

-- 1. Replace the unique constraint to include workspace_id
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_owner_id_email_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'team_members_owner_id_email_workspace_key'
  ) THEN
    ALTER TABLE team_members
      ADD CONSTRAINT team_members_owner_id_email_workspace_key
      UNIQUE (owner_id, email, workspace_id);
  END IF;
END $$;

-- 2. Backfill missing owner team members for existing workspaces
DO $$
DECLARE
  w record;
  owner_email text;
BEGIN
  FOR w IN
    SELECT id, owner_id FROM workspaces
  LOOP
    -- Skip if a team member already exists for this workspace+owner
    IF EXISTS (
      SELECT 1 FROM team_members
      WHERE workspace_id = w.id AND owner_id = w.owner_id
    ) THEN
      CONTINUE;
    END IF;

    -- Get the owner's email from auth.users
    SELECT email INTO owner_email FROM auth.users WHERE id = w.owner_id;
    IF owner_email IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO team_members (owner_id, email, role, full_name, status, workspace_id)
    VALUES (w.owner_id, owner_email, 'admin', owner_email, 'active', w.id);
  END LOOP;
END $$;
