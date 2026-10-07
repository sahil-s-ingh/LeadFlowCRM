/*
# Create role_permissions table for customizable role-based access control

1. Purpose
- Allow the CRM owner to manually customize which features each role (admin, manager, agent) can access.
- Instead of hardcoded permissions, the owner can toggle individual feature permissions per role.
- When a team member logs in, their role's custom permissions are loaded from this table.
- If no custom permissions exist for a role, the system falls back to default hardcoded permissions.

2. New Tables
- `role_permissions`
  - `id` uuid PK
  - `owner_id` uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE — the CRM owner who set these permissions
  - `role` text NOT NULL CHECK (role IN ('admin', 'manager', 'agent')) — which role these permissions apply to
  - `leads` boolean NOT NULL DEFAULT true — can view leads
  - `inbox` boolean NOT NULL DEFAULT true — can access Telegram/WhatsApp inbox
  - `export` boolean NOT NULL DEFAULT false — can export leads
  - `delete_leads` boolean NOT NULL DEFAULT false — can delete leads
  - `add_leads` boolean NOT NULL DEFAULT true — can add new leads
  - `bulk_upload` boolean NOT NULL DEFAULT false — can bulk upload leads
  - `dialer` boolean NOT NULL DEFAULT false — can use the dialer
  - `settings` boolean NOT NULL DEFAULT false — can access settings
  - `team_management` boolean NOT NULL DEFAULT false — can manage team members
  - `created_at` timestamptz DEFAULT now()
  - `updated_at` timestamptz DEFAULT now()
  - UNIQUE(owner_id, role) — one permission set per role per owner

3. Security
- RLS enabled on role_permissions.
- Only the owner (owner_id = auth.uid()) can SELECT, INSERT, UPDATE, DELETE their role permissions.
- Team members cannot modify permissions — only the owner can.
*/

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'agent')),
  leads boolean NOT NULL DEFAULT true,
  inbox boolean NOT NULL DEFAULT true,
  export boolean NOT NULL DEFAULT false,
  delete_leads boolean NOT NULL DEFAULT false,
  add_leads boolean NOT NULL DEFAULT true,
  bulk_upload boolean NOT NULL DEFAULT false,
  dialer boolean NOT NULL DEFAULT false,
  settings boolean NOT NULL DEFAULT false,
  team_management boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (owner_id, role)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_owner ON role_permissions(owner_id);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_role_permissions" ON role_permissions;
CREATE POLICY "select_own_role_permissions" ON role_permissions FOR SELECT
  TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "insert_own_role_permissions" ON role_permissions;
CREATE POLICY "insert_own_role_permissions" ON role_permissions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "update_own_role_permissions" ON role_permissions;
CREATE POLICY "update_own_role_permissions" ON role_permissions FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "delete_own_role_permissions" ON role_permissions;
CREATE POLICY "delete_own_role_permissions" ON role_permissions FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);
