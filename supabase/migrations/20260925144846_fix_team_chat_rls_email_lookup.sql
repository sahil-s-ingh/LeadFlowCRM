/*
# Fix team_chat_messages RLS to use auth.users.email instead of raw_user_meta_data

The original policies used raw_user_meta_data->>'email' which is unreliable —
the email is stored in auth.users.email. This fix ensures team members can
read and send messages based on the email they signed up with, matching
whatever email the owner entered in team management.
*/

-- Drop the broken policies
DROP POLICY IF EXISTS "select_team_chat" ON team_chat_messages;
DROP POLICY IF EXISTS "insert_team_chat" ON team_chat_messages;

-- Recreate using auth.users.email directly (the reliable source)
CREATE POLICY "select_team_chat" ON team_chat_messages FOR SELECT
  TO authenticated USING (
    auth.uid() = team_owner_id
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.owner_id = team_chat_messages.team_owner_id
        AND team_members.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND team_members.status = 'active'
    )
  );

CREATE POLICY "insert_team_chat" ON team_chat_messages FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = team_owner_id
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.owner_id = team_chat_messages.team_owner_id
        AND team_members.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND team_members.status = 'active'
    )
  );
