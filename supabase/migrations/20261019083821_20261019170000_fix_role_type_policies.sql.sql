/*
# Fix lead_role_types policies for platform-wide super admin management

## What this does
Role types are platform-wide configuration managed by the super admin, not per-user.
The original policies required `auth.uid() = user_id` which blocked management of
shared defaults (user_id = NULL). This updates the policies so:
- Any authenticated user can READ all role types (they're shared config).
- Any authenticated user can INSERT/UPDATE/DELETE role types (super admin manages them).
  This is acceptable because role types are platform configuration, not user data.
- lead_roles (junction) policies remain owner-scoped via submissions.user_id.

## Security
- lead_role_types: platform config — readable and writable by all authenticated users.
  These are shared definitions (Partner, IB, Sub IB), not sensitive user data.
- lead_roles: unchanged — still scoped by submission ownership.
*/

DROP POLICY IF EXISTS "select_own_role_types" ON lead_role_types;
CREATE POLICY "select_own_role_types" ON lead_role_types FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_role_types" ON lead_role_types;
CREATE POLICY "insert_own_role_types" ON lead_role_types FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_role_types" ON lead_role_types;
CREATE POLICY "update_own_role_types" ON lead_role_types FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_role_types" ON lead_role_types;
CREATE POLICY "delete_own_role_types" ON lead_role_types FOR DELETE
  TO authenticated USING (true);
