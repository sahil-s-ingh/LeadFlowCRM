/*
# Add lead assignment feature

1. Purpose
- Allow automatic round-robin assignment of new leads to active team members.
- Admin can enable/disable auto-assignment and select which team members are eligible.
- Each lead gets an `assigned_to` field linking to the team member responsible.

2. New Columns on `submissions`
- `assigned_to` (uuid, nullable) — references team_members(id) ON DELETE SET NULL
  - When null, the lead is unassigned (visible to all).
  - When set, the lead is assigned to that specific team member.

3. New Tables
- `lead_assignment_settings`
  - `id` uuid PK
  - `user_id` uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE — the account owner
  - `enabled` boolean NOT NULL DEFAULT false — whether auto-assignment is active
  - `strategy` text NOT NULL DEFAULT 'round_robin' CHECK (strategy IN ('round_robin'))
  - `last_assigned_index` integer NOT NULL DEFAULT 0 — tracks round-robin position
  - `created_at` timestamptz DEFAULT now()
  - `updated_at` timestamptz DEFAULT now()
  - UNIQUE(user_id) — one config per account

4. Security
- RLS enabled on lead_assignment_settings.
- Only the owner (user_id = auth.uid()) can SELECT, INSERT, UPDATE their assignment config.
- The `assigned_to` column on submissions is writable by authenticated users (covered by existing UPDATE policy).

5. Notes
- The `assigned_to` column is nullable so existing leads remain unassigned.
- Auto-assignment logic runs in the frontend: after fetching eligible team members, pick the next one round-robin.
- The `last_assigned_index` is updated atomically after each assignment.
*/

-- Add assigned_to column to submissions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'assigned_to') THEN
    ALTER TABLE submissions ADD COLUMN assigned_to uuid REFERENCES team_members(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_assigned_to ON submissions(assigned_to);

-- Create lead_assignment_settings table
CREATE TABLE IF NOT EXISTS lead_assignment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  strategy text NOT NULL DEFAULT 'round_robin' CHECK (strategy IN ('round_robin')),
  last_assigned_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE lead_assignment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_assignment_settings" ON lead_assignment_settings;
CREATE POLICY "select_own_assignment_settings" ON lead_assignment_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_assignment_settings" ON lead_assignment_settings;
CREATE POLICY "insert_own_assignment_settings" ON lead_assignment_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_assignment_settings" ON lead_assignment_settings;
CREATE POLICY "update_own_assignment_settings" ON lead_assignment_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_assignment_settings" ON lead_assignment_settings;
CREATE POLICY "delete_own_assignment_settings" ON lead_assignment_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);