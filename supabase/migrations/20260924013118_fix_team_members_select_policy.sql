/*
# Fix team_members SELECT policy for email-based lookup

1. Purpose
- Team members need to read their own row to discover their role.
- The original policy used raw_user_meta_data which may not contain email.
- Use auth.jwt() ->> 'email' instead, which reliably contains the user's email.

2. Security
- Replaces the SELECT policy on team_members.
- Owner (owner_id = auth.uid()) can see all their team members.
- Any authenticated user can see rows where email matches their own JWT email claim.
*/

DROP POLICY IF EXISTS "select_own_team_members" ON team_members;
CREATE POLICY "select_own_team_members" ON team_members FOR SELECT
  TO authenticated USING (
    auth.uid() = owner_id
    OR email = auth.jwt() ->> 'email'
  );