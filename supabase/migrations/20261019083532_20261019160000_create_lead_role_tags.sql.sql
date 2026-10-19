/*
# Conversion Role Tags — role types and per-lead role assignments

## What this does
1. Creates `lead_role_types` table — customizable role definitions (e.g. Partner, IB, Sub IB)
   that super admins can add/edit/delete. Each role type has a name, color, description, and sort order.
2. Creates `lead_roles` junction table — multi-select role assignments for leads (submissions).
   A lead can have multiple roles (e.g. both Partner AND IB).
3. Seeds three default role types: Partner, IB, Sub IB.
4. Enables RLS on both tables with appropriate policies.

## New Tables

### lead_role_types
- `id` (uuid, PK)
- `name` (text, unique per user, not null) — e.g. "Partner", "IB", "Sub IB"
- `color` (text, not null) — hex color for the role dot, e.g. "#2563eb"
- `description` (text, nullable) — optional description of what this role means
- `sort_order` (int, default 0) — display ordering
- `is_active` (boolean, default true) — soft-disable a role without deleting
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### lead_roles
- `id` (uuid, PK)
- `submission_id` (uuid, FK to submissions.id ON DELETE CASCADE)
- `role_type_id` (uuid, FK to lead_role_types.id ON DELETE CASCADE)
- `assigned_at` (timestamptz, default now())
- `assigned_by` (uuid, nullable, FK to auth.users)
- Unique constraint on (submission_id, role_type_id) to prevent duplicates

## Security
- `lead_role_types`: readable by all authenticated users (shared config + own custom types);
  writable only by the owner (user_id match). user_id = NULL rows are shared defaults.
- `lead_roles`: owner-scoped via submissions.user_id — users can only assign/view roles for
  leads they own.

## Notes
1. Default roles (Partner=blue, IB=green, Sub IB=amber) are seeded as shared defaults (user_id=NULL).
2. The junction table allows multi-select — a lead can be both Partner and IB simultaneously.
3. Deleting a role type cascades to remove all lead_roles assignments for that type.
4. Deleting a lead (submission) cascades to remove all role assignments for that lead.
*/

-- ===================== lead_role_types =====================
CREATE TABLE IF NOT EXISTS lead_role_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#2563eb',
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE lead_role_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_role_types" ON lead_role_types;
CREATE POLICY "select_own_role_types" ON lead_role_types FOR SELECT
  TO authenticated USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_role_types" ON lead_role_types;
CREATE POLICY "insert_own_role_types" ON lead_role_types FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_role_types" ON lead_role_types;
CREATE POLICY "update_own_role_types" ON lead_role_types FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_role_types" ON lead_role_types;
CREATE POLICY "delete_own_role_types" ON lead_role_types FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ===================== lead_roles (junction) =====================
CREATE TABLE IF NOT EXISTS lead_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  role_type_id uuid NOT NULL REFERENCES lead_role_types(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(submission_id, role_type_id)
);

ALTER TABLE lead_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lead_roles" ON lead_roles;
CREATE POLICY "select_own_lead_roles" ON lead_roles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM submissions WHERE submissions.id = lead_roles.submission_id AND submissions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_lead_roles" ON lead_roles;
CREATE POLICY "insert_own_lead_roles" ON lead_roles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM submissions WHERE submissions.id = lead_roles.submission_id AND submissions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_lead_roles" ON lead_roles;
CREATE POLICY "update_own_lead_roles" ON lead_roles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM submissions WHERE submissions.id = lead_roles.submission_id AND submissions.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM submissions WHERE submissions.id = lead_roles.submission_id AND submissions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_lead_roles" ON lead_roles;
CREATE POLICY "delete_own_lead_roles" ON lead_roles FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM submissions WHERE submissions.id = lead_roles.submission_id AND submissions.user_id = auth.uid())
  );

-- Index for filtering leads by role
CREATE INDEX IF NOT EXISTS idx_lead_roles_submission_id ON lead_roles(submission_id);
CREATE INDEX IF NOT EXISTS idx_lead_roles_role_type_id ON lead_roles(role_type_id);

-- Seed default role types as shared defaults (user_id = NULL)
INSERT INTO lead_role_types (user_id, name, color, description, sort_order, is_active)
SELECT NULL, 'Partner', '#2563eb', 'Business partner relationship', 1, true
WHERE NOT EXISTS (SELECT 1 FROM lead_role_types WHERE user_id IS NULL AND name = 'Partner');

INSERT INTO lead_role_types (user_id, name, color, description, sort_order, is_active)
SELECT NULL, 'IB', '#16a34a', 'Introducing Broker', 2, true
WHERE NOT EXISTS (SELECT 1 FROM lead_role_types WHERE user_id IS NULL AND name = 'IB');

INSERT INTO lead_role_types (user_id, name, color, description, sort_order, is_active)
SELECT NULL, 'Sub IB', '#f59e0b', 'Sub Introducing Broker', 3, true
WHERE NOT EXISTS (SELECT 1 FROM lead_role_types WHERE user_id IS NULL AND name = 'Sub IB');
