/*
# Create WhatsApp Template Approval Notifications table

1. New Tables
- `wa_template_notifications`
  - `id` (uuid, primary key)
  - `user_id` (uuid, owner of the notification, defaults to auth.uid())
  - `template_name` (text, name of the template whose status changed)
  - `template_language` (text, language of the template)
  - `old_status` (text, previous status e.g. PENDING)
  - `new_status` (text, new status e.g. APPROVED or REJECTED)
  - `rejection_reason` (text, nullable, reason if rejected)
  - `phone_label` (text, nullable, label of the WhatsApp number)
  - `read` (boolean, default false, whether the user has seen it)
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `wa_template_notifications`.
- Owner-scoped CRUD: each authenticated user can only access their own notifications.

3. Indexes
- Index on `user_id` + `read` for fast unread count queries.
- Index on `created_at` descending for listing recent notifications.
*/

CREATE TABLE IF NOT EXISTS wa_template_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  template_language text NOT NULL DEFAULT '',
  old_status text NOT NULL DEFAULT '',
  new_status text NOT NULL,
  rejection_reason text,
  phone_label text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wa_template_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON wa_template_notifications;
CREATE POLICY "select_own_notifications"
  ON wa_template_notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON wa_template_notifications;
CREATE POLICY "insert_own_notifications"
  ON wa_template_notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON wa_template_notifications;
CREATE POLICY "update_own_notifications"
  ON wa_template_notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON wa_template_notifications;
CREATE POLICY "delete_own_notifications"
  ON wa_template_notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_template_notifications_user_read
  ON wa_template_notifications(user_id, read);

CREATE INDEX IF NOT EXISTS idx_wa_template_notifications_created_at
  ON wa_template_notifications(created_at DESC);
