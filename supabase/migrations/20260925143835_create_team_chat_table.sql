/*
# Create team_chat_messages table for internal team chat

1. Purpose
- Allow CRM team members to chat internally with each other from within the CRM dashboard.
- Messages are scoped to the team (owner's organization), not 1:1 channels.
- All active team members + the owner can see and send messages in a shared team room.

2. New Tables
- `team_chat_messages`
  - `id` uuid PK
  - `team_owner_id` uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE — the owner of the team (organization scope)
  - `sender_id` uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE — the user who sent the message
  - `sender_name` text NOT NULL — display name of sender (denormalized for quick display)
  - `sender_role` text NOT NULL DEFAULT 'agent' — role label at time of send ('owner', 'admin', 'manager', 'agent')
  - `message_text` text NOT NULL — the message content
  - `created_at` timestamptz DEFAULT now()

3. Security
- RLS enabled on team_chat_messages.
- Any authenticated user who is the team owner OR an active team member of that owner can SELECT, INSERT.
- DELETE restricted to the sender only.
*/

CREATE TABLE IF NOT EXISTS team_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  sender_role text NOT NULL DEFAULT 'agent',
  message_text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_chat_team_owner ON team_chat_messages(team_owner_id);
CREATE INDEX IF NOT EXISTS idx_team_chat_created_at ON team_chat_messages(created_at);

ALTER TABLE team_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_team_chat" ON team_chat_messages;
CREATE POLICY "select_team_chat" ON team_chat_messages FOR SELECT
  TO authenticated USING (
    auth.uid() = team_owner_id
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.owner_id = team_chat_messages.team_owner_id
        AND team_members.email = (SELECT raw_user_meta_data->>'email' FROM auth.users WHERE id = auth.uid())
        AND team_members.status = 'active'
    )
  );

DROP POLICY IF EXISTS "insert_team_chat" ON team_chat_messages;
CREATE POLICY "insert_team_chat" ON team_chat_messages FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = team_owner_id
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.owner_id = team_chat_messages.team_owner_id
        AND team_members.email = (SELECT raw_user_meta_data->>'email' FROM auth.users WHERE id = auth.uid())
        AND team_members.status = 'active'
    )
  );

DROP POLICY IF EXISTS "delete_own_team_chat" ON team_chat_messages;
CREATE POLICY "delete_own_team_chat" ON team_chat_messages FOR DELETE
  TO authenticated USING (auth.uid() = sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE team_chat_messages;
