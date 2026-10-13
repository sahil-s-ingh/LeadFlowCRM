/*
# Create lead_notes table — append-only timestamped notes per lead

1. Purpose
   - Currently notes are a single text field on `submissions` that gets overwritten on each save.
   - This migration creates a dedicated `lead_notes` table so every note is stored as a separate
     entry with author, full text, and exact timestamp — enabling a notes timeline in the lead drawer.

2. New Tables
   - `lead_notes`
     - `id` (uuid, primary key)
     - `lead_id` (uuid, FK to submissions.id, ON DELETE CASCADE)
     - `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), FK to auth.users.id, ON DELETE CASCADE)
     - `note` (text, NOT NULL) — full note text
     - `stage_at_time` (text) — the lead's status when the note was saved, for stage timeline context
     - `created_at` (timestamptz, DEFAULT now())

3. Security
   - RLS enabled on `lead_notes`.
   - 4 owner-scoped policies (SELECT/INSERT/UPDATE/DELETE) using `auth.uid() = user_id`, scoped TO authenticated.

4. Indexes
   - Index on `lead_id` for fast per-lead queries.
   - Index on `user_id` for owner-scoped filtering.
   - Index on `created_at DESC` for timeline ordering.

5. Important Notes
   - The existing `submissions.notes` column is NOT removed or altered — existing notes stay intact.
   - The new table is additive only.
*/

CREATE TABLE IF NOT EXISTS lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  stage_at_time text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lead_notes" ON lead_notes;
CREATE POLICY "select_own_lead_notes" ON lead_notes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_lead_notes" ON lead_notes;
CREATE POLICY "insert_own_lead_notes" ON lead_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_lead_notes" ON lead_notes;
CREATE POLICY "update_own_lead_notes" ON lead_notes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_lead_notes" ON lead_notes;
CREATE POLICY "delete_own_lead_notes" ON lead_notes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_user_id ON lead_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at ON lead_notes(created_at DESC);
