/*
# Create follow_up_settings table

Stores follow-up reminder preferences (reminder email, enable/disable reminders).
Single row per user (queried with maybeSingle).
*/

CREATE TABLE IF NOT EXISTS follow_up_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_email text,
  enable_reminders boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE follow_up_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_follow_up_settings" ON follow_up_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_follow_up_settings" ON follow_up_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_follow_up_settings" ON follow_up_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_follow_up_settings" ON follow_up_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);