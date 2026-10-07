-- Lead follow-up reminders table
CREATE TABLE IF NOT EXISTS lead_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES submissions(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Follow up reminder',
  note text,
  reminder_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'snoozed', 'done')),
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE lead_followups ENABLE ROW LEVEL SECURITY;

-- CRUD policies (authenticated users manage their own reminders)
CREATE POLICY "select_own_followups" ON lead_followups FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_followups" ON lead_followups FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_followups" ON lead_followups FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_followups" ON lead_followups FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Index for quick lookup of due reminders
CREATE INDEX idx_lead_followups_pending ON lead_followups (reminder_at) WHERE status = 'pending';

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE lead_followups;
