/*
# Internal Notes & Labels for WhatsApp Conversations

1. New Tables
- `wa_conv_notes` — private internal notes pinned to a conversation, visible only to the team (not sent to the contact)
  - `id` uuid PK
  - `conversation_id` uuid NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE
  - `user_id` uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE — who wrote the note
  - `body` text NOT NULL — the note content
  - `author_name` text — display name of the note author (denormalized for convenience)
  - `created_at` timestamptz DEFAULT now()

2. Modified Tables
- `wa_conversations` — add `labels` column (text[]) for color-coded conversation tags
  - `labels` text[] NOT NULL DEFAULT '{}' — array of label strings, e.g. {'Hot Lead','Follow Up'}

3. Indexes
- `idx_wa_conv_notes_conversation` ON wa_conv_notes(conversation_id, created_at DESC)

4. Security
- RLS enabled on wa_conv_notes
- Owner-scoped: only the conversation owner (via wa_conversations.user_id) can read/insert/delete notes
- wa_conversations.labels is covered by existing owner-scoped UPDATE policy
*/

CREATE TABLE IF NOT EXISTS wa_conv_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_name text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_notes_conversation ON wa_conv_notes(conversation_id, created_at DESC);

ALTER TABLE wa_conv_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_conv_notes" ON wa_conv_notes;
CREATE POLICY "select_own_wa_conv_notes" ON wa_conv_notes FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wa_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_wa_conv_notes" ON wa_conv_notes;
CREATE POLICY "insert_own_wa_conv_notes" ON wa_conv_notes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM wa_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_wa_conv_notes" ON wa_conv_notes;
CREATE POLICY "delete_own_wa_conv_notes" ON wa_conv_notes FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wa_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

-- Add labels column to wa_conversations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wa_conversations' AND column_name = 'labels') THEN
    ALTER TABLE wa_conversations ADD COLUMN labels text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;
