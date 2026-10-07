/*
# Fix: permission denied for table users

The RLS policies on team_chat_messages and team_members were querying
auth.users directly (SELECT email FROM auth.users WHERE id = auth.uid()).
This fails because the PostgREST API role cannot access auth.users.

Fix: use auth.jwt() ->> 'email' instead, which reads the email from
the user's JWT token without touching the auth.users table.
*/

-- Fix team_chat_messages SELECT
DROP POLICY IF EXISTS "select_team_chat" ON team_chat_messages;
CREATE POLICY "select_team_chat" ON team_chat_messages FOR SELECT
  TO authenticated USING (
    auth.uid() = team_owner_id
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.owner_id = team_chat_messages.team_owner_id
        AND team_members.email = (auth.jwt() ->> 'email')
        AND team_members.status = 'active'
    )
  );

-- Fix team_chat_messages INSERT
DROP POLICY IF EXISTS "insert_team_chat" ON team_chat_messages;
CREATE POLICY "insert_team_chat" ON team_chat_messages FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = team_owner_id
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.owner_id = team_chat_messages.team_owner_id
        AND team_members.email = (auth.jwt() ->> 'email')
        AND team_members.status = 'active'
    )
  );

-- Fix team_members SELECT
DROP POLICY IF EXISTS "select_own_team_members" ON team_members;
CREATE POLICY "select_own_team_members" ON team_members FOR SELECT
  TO authenticated USING (
    auth.uid() = owner_id
    OR email = (auth.jwt() ->> 'email')
  );
