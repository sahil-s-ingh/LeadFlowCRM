/*
# Fix team_members SELECT policy to use auth.users.email

Same issue as team_chat_messages: the policy used raw_user_meta_data->>'email'
which is unreliable. The email is in auth.users.email.
*/

DROP POLICY IF EXISTS "select_own_team_members" ON team_members;

CREATE POLICY "select_own_team_members" ON team_members FOR SELECT
  TO authenticated USING (
    auth.uid() = owner_id
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
