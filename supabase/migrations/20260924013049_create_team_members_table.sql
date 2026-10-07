/*
# Create team_members table for role-based CRM access

1. Purpose
- Allow the CRM owner (admin) to invite employees and assign them roles.
- Roles control what employees can see and do in the CRM dashboard.
- Owner invites by email; the employee signs up with that email and is automatically linked.

2. New Tables
- `team_members`
  - `id` uuid PK
  - `owner_id` uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE — the admin who invited this member
  - `email` text NOT NULL — the invited employee's email (must match their signup email)
  - `role` text NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent'))
    - admin: full access (leads, inbox, settings, team management, delete leads)
    - manager: leads + inbox + export, no settings or team management, no delete
    - agent: view leads only, no delete, no export, no inbox
  - `full_name` text — employee's display name (set after they join)
  - `status` text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled'))
    - pending: invited but not yet signed up
    - active: signed up and linked
    - disabled: admin revoked access
  - `created_at` timestamptz DEFAULT now()
  - `updated_at` timestamptz DEFAULT now()
  - UNIQUE(owner_id, email)

3. Security
- RLS enabled on team_members.
- Owner (owner_id = auth.uid()) can SELECT, INSERT, UPDATE, DELETE their team members.
- Employees can read their own team_members row (to know their role) — checked by matching email to auth.jwt() -> email.
*/

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent')),
  full_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (owner_id, email)
);

CREATE INDEX IF NOT EXISTS idx_team_members_owner ON team_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Owner can see all their team members
DROP POLICY IF EXISTS "select_own_team_members" ON team_members;
CREATE POLICY "select_own_team_members" ON team_members FOR SELECT
  TO authenticated USING (
    auth.uid() = owner_id
    OR email = (SELECT raw_user_meta_data->>'email' FROM auth.users WHERE id = auth.uid())
  );

-- Owner can add team members
DROP POLICY IF EXISTS "insert_own_team_members" ON team_members;
CREATE POLICY "insert_own_team_members" ON team_members FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

-- Owner can update team members (change role, status)
DROP POLICY IF EXISTS "update_own_team_members" ON team_members;
CREATE POLICY "update_own_team_members" ON team_members FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Owner can remove team members
DROP POLICY IF EXISTS "delete_own_team_members" ON team_members;
CREATE POLICY "delete_own_team_members" ON team_members FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);