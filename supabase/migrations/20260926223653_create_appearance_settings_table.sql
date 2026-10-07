/*
# Create appearance_settings table

## Purpose
Stores per-user UI appearance preferences: border color and border width for the CRM dashboard.
Allows the admin to customize the border styling of cards, inputs, and panels across the CRM.

## New Table: appearance_settings
- id (uuid PK)
- user_id (uuid, FK→auth.users CASCADE, DEFAULT auth.uid()) — owner
- border_color (text, DEFAULT '#e2e8f0') — hex color for borders
- border_width (integer, DEFAULT 1) — border width in px (0-10)
- border_radius (integer, DEFAULT 16) — border radius in px (0-32)
- updated_at (timestamptz, DEFAULT now())

## Security (RLS)
- Enable RLS
- Owner-scoped CRUD (auth.uid() = user_id)
*/

CREATE TABLE IF NOT EXISTS appearance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  border_color text NOT NULL DEFAULT '#e2e8f0',
  border_width integer NOT NULL DEFAULT 1 CHECK (border_width >= 0 AND border_width <= 10),
  border_radius integer NOT NULL DEFAULT 16 CHECK (border_radius >= 0 AND border_radius <= 32),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appearance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_appearance" ON appearance_settings;
CREATE POLICY "select_own_appearance" ON appearance_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_appearance" ON appearance_settings;
CREATE POLICY "insert_own_appearance" ON appearance_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_appearance" ON appearance_settings;
CREATE POLICY "update_own_appearance" ON appearance_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_appearance" ON appearance_settings;
CREATE POLICY "delete_own_appearance" ON appearance_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
