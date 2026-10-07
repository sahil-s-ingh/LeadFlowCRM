/*
# Allow team members to read their owner's role permissions

1. Purpose
- Team members need to read the custom permissions their owner set for their role.
- The existing RLS only allows the owner (owner_id = auth.uid()) to read role_permissions.
- This adds a SELECT policy so team members can read their owner's role_permissions rows.

2. Security changes
- New SELECT policy: team members can read role_permissions where their team_members.owner_id matches role_permissions.owner_id.
- This only exposes boolean permission flags, not sensitive data.
- INSERT/UPDATE/DELETE remain owner-only.
*/

DROP POLICY IF EXISTS "select_own_role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "team_members_read_role_permissions" ON role_permissions;

CREATE POLICY "select_own_role_permissions" ON role_permissions FOR SELECT
  TO authenticated USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.email = (SELECT raw_user_meta_data->>'email' FROM auth.users WHERE id = auth.uid())
      AND tm.owner_id = role_permissions.owner_id
      AND tm.status = 'active'
    )
  );
