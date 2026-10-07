/*
# Pipeline Auto-Assign Settings

1. New Tables
- `pipeline_autoassign_settings`
  - `id` (uuid, primary key)
  - `user_id` (uuid, owner of the settings)
  - `enabled` (boolean, default true — when on, moving a lead from "New" to another stage auto-assigns it to the person who changed it)
  - `assign_on_stages` (text[], default all non-new stages that trigger auto-assignment)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- Enable RLS on `pipeline_autoassign_settings`.
- Owner-scoped CRUD: each authenticated user can only manage their own settings row.
*/

CREATE TABLE IF NOT EXISTS pipeline_autoassign_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  assign_on_stages text[] NOT NULL DEFAULT ARRAY['called_no_response','called_responded','interested','not_interested','converted'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pipeline_autoassign_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_pipeline_autoassign" ON pipeline_autoassign_settings;
CREATE POLICY "select_own_pipeline_autoassign"
ON pipeline_autoassign_settings FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_pipeline_autoassign" ON pipeline_autoassign_settings;
CREATE POLICY "insert_own_pipeline_autoassign"
ON pipeline_autoassign_settings FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_pipeline_autoassign" ON pipeline_autoassign_settings;
CREATE POLICY "update_own_pipeline_autoassign"
ON pipeline_autoassign_settings FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_pipeline_autoassign" ON pipeline_autoassign_settings;
CREATE POLICY "delete_own_pipeline_autoassign"
ON pipeline_autoassign_settings FOR DELETE
TO authenticated USING (auth.uid() = user_id);
