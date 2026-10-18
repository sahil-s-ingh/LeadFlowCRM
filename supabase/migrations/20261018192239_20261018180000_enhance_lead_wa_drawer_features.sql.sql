/*
# Enhance Lead WhatsApp Drawer — Advanced Features

## Summary
Adds schema support for several advanced features in the lead-side WhatsApp drawer:
pinned messages, internal team reactions on messages, conversation assignment to
teammates, and auto-follow-up automation when a lead does not reply.

## Tables/Columns added

1. `wa_conversations`
   - `pinned_message_id` (uuid, nullable) — references wa_messages.id, used to pin one
     message to the top of the chat for quick reference.
   - `assigned_to` (uuid, nullable) — references auth.users.id. Records which teammate
     currently owns this conversation (separate from lead-level assignment so a chat
     can be handed off without changing the lead owner).
   - `auto_followup_enabled` (boolean, default false) — when true, the system will
     automatically send a follow-up template if the lead does not reply within the
     configured delay window after the agent's last outbound message.
   - `auto_followup_template_name` (text, nullable) — name of the approved WA template
     to send for the auto follow-up.
   - `auto_followup_delay_hours` (integer, default 24) — hours to wait after the last
     outbound message before sending the auto follow-up.
   - `auto_followup_last_sent_at` (timestamptz, nullable) — timestamp of the last auto
     follow-up sent, to prevent duplicate sends.

2. New table `wa_message_reactions`
   - Stores internal-team reactions (emoji) on WhatsApp messages. These are private
     team signals, not sent to the customer.
   - `id` uuid primary key
   - `message_id` uuid NOT NULL references wa_messages(id) ON DELETE CASCADE
   - `user_id` uuid NOT NULL DEFAULT auth.uid() references auth.users(id) ON DELETE CASCADE
   - `emoji` text NOT NULL — the reaction emoji
   - `created_at` timestamptz DEFAULT now()
   - Unique constraint on (message_id, user_id, emoji) to prevent duplicate reactions
     by the same user with the same emoji.

## Security
- RLS enabled on `wa_message_reactions`. Owner-scoped CRUD: each authenticated user
  can read all reactions in their own conversations, and insert/update/delete only
  their own reactions. SELECT is scoped to authenticated (so teammates can see each
  other's reactions); write checks use auth.uid() = user_id.
- No destructive changes to existing tables. All ALTER TABLE statements use
  IF NOT EXISTS for idempotency.

## Important notes
- The auto-follow-up processor (cron) is intentionally NOT added in this migration;
  the toggle and settings are stored now, and the processor can be wired up later
  by extending process-followups. The frontend will surface the toggle so teams can
  pre-configure it.
- `assigned_to` is distinct from the lead-level `assigned_to` on submissions so chat
  handoff does not require changing the lead owner.
*/

-- 1. Add columns to wa_conversations
ALTER TABLE wa_conversations
  ADD COLUMN IF NOT EXISTS pinned_message_id uuid REFERENCES wa_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_followup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_followup_template_name text,
  ADD COLUMN IF NOT EXISTS auto_followup_delay_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS auto_followup_last_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_conversations_assigned_to ON wa_conversations(assigned_to) WHERE assigned_to IS NOT NULL;

-- 2. Create wa_message_reactions table
CREATE TABLE IF NOT EXISTS wa_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES wa_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE wa_message_reactions ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can see reactions on messages in conversations they own
DROP POLICY IF EXISTS "select_own_wa_reactions" ON wa_message_reactions;
CREATE POLICY "select_own_wa_reactions" ON wa_message_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wa_conversations c
      JOIN wa_messages m ON m.conversation_id = c.id
      WHERE m.id = wa_message_reactions.message_id
        AND c.user_id = auth.uid()
    )
  );

-- INSERT: only your own user_id
DROP POLICY IF EXISTS "insert_own_wa_reactions" ON wa_message_reactions;
CREATE POLICY "insert_own_wa_reactions" ON wa_message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- DELETE: only your own reactions
DROP POLICY IF EXISTS "delete_own_wa_reactions" ON wa_message_reactions;
CREATE POLICY "delete_own_wa_reactions" ON wa_message_reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for reactions
ALTER TABLE wa_message_reactions REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wa_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_message_reactions;
  END IF;
END $$;
