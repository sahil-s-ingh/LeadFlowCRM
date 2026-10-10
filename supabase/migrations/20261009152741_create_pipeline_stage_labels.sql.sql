/*
# Create pipeline_stage_labels table

## Purpose
Allows each account owner to customize the display labels for the 6 fixed pipeline stages.
The internal stage keys (new, called_no_response, called_responded, interested, not_interested, converted)
remain unchanged so automations, filters, analytics, and Meta conversion events keep working.
Only the user-facing display text changes.

## New Tables
- `pipeline_stage_labels`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, references auth.users, ON DELETE CASCADE) — the account owner
  - `stage_key` (text, not null) — one of the 6 fixed keys
  - `label` (text, not null) — the custom display label
  - `updated_at` (timestamptz, default now())
  - Unique constraint on (user_id, stage_key) so each owner has one label per stage

## Security
- RLS enabled.
- Owner-scoped CRUD: each authenticated user can only manage their own stage labels.
*/

CREATE TABLE IF NOT EXISTS pipeline_stage_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  label text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, stage_key)
);

ALTER TABLE pipeline_stage_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_stage_labels" ON pipeline_stage_labels;
CREATE POLICY "select_own_stage_labels" ON pipeline_stage_labels FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_stage_labels" ON pipeline_stage_labels;
CREATE POLICY "insert_own_stage_labels" ON pipeline_stage_labels
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_stage_labels" ON pipeline_stage_labels;
CREATE POLICY "update_own_stage_labels" ON pipeline_stage_labels
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_stage_labels" ON pipeline_stage_labels;
CREATE POLICY "delete_own_stage_labels" ON pipeline_stage_labels
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
