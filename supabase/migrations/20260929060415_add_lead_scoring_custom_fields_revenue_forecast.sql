/*
# Add Lead Scoring, Custom Lead Fields, and Revenue Forecast Support

1. New Tables
- `custom_lead_fields` — Defines custom fields that admins can add to leads (e.g. "Loan Type", "Business Name").
  - id (uuid PK)
  - user_id (uuid, owner, defaults to auth.uid())
  - field_name (text, display label)
  - field_key (text, machine key, unique per user)
  - field_type (text: 'text','number','select','date','textarea')
  - options (jsonb, for select-type fields: array of string options)
  - sort_order (int, display order)
  - created_at (timestamptz)

- `custom_lead_field_values` — Stores the actual values of custom fields per lead.
  - id (uuid PK)
  - user_id (uuid, owner, defaults to auth.uid())
  - lead_id (uuid FK→submissions(id) ON DELETE CASCADE)
  - field_id (uuid FK→custom_lead_fields(id) ON DELETE CASCADE)
  - field_value (text, the stored value)
  - created_at (timestamptz)
  - UNIQUE(lead_id, field_id)

2. Modified Tables
- `submissions` — Added `lead_score` (integer, default 0) and `lead_score_updated_at` (timestamptz, nullable).
  These power the Lead Scoring feature. Scores are computed client-side from engagement signals
  and persisted so they can be filtered and sorted.

3. Security
- Enable RLS on both new tables.
- Owner-scoped CRUD on custom_lead_fields (auth.uid() = user_id).
- Owner-scoped CRUD on custom_lead_field_values (auth.uid() = user_id).
- The submissions table already has RLS enabled; the new columns inherit existing policies.

4. Indexes
- custom_lead_fields(user_id)
- custom_lead_field_values(lead_id)
- custom_lead_field_values(user_id, field_id)
- submissions(user_id) — not added since submissions uses permissive RLS, but lead_score index added for sorting.
*/

-- Add lead_score columns to submissions
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS lead_score integer NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS lead_score_updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_submissions_lead_score ON submissions(lead_score DESC);

-- Create custom_lead_fields table
CREATE TABLE IF NOT EXISTS custom_lead_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text','number','select','date','textarea')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, field_key)
);

ALTER TABLE custom_lead_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_custom_fields" ON custom_lead_fields;
CREATE POLICY "select_own_custom_fields" ON custom_lead_fields FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_custom_fields" ON custom_lead_fields;
CREATE POLICY "insert_own_custom_fields" ON custom_lead_fields FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_custom_fields" ON custom_lead_fields;
CREATE POLICY "update_own_custom_fields" ON custom_lead_fields FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_custom_fields" ON custom_lead_fields;
CREATE POLICY "delete_own_custom_fields" ON custom_lead_fields FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_custom_lead_fields_user ON custom_lead_fields(user_id);

-- Create custom_lead_field_values table
CREATE TABLE IF NOT EXISTS custom_lead_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES custom_lead_fields(id) ON DELETE CASCADE,
  field_value text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, field_id)
);

ALTER TABLE custom_lead_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_field_values" ON custom_lead_field_values;
CREATE POLICY "select_own_field_values" ON custom_lead_field_values FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_field_values" ON custom_lead_field_values;
CREATE POLICY "insert_own_field_values" ON custom_lead_field_values FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_field_values" ON custom_lead_field_values;
CREATE POLICY "update_own_field_values" ON custom_lead_field_values FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_field_values" ON custom_lead_field_values;
CREATE POLICY "delete_own_field_values" ON custom_lead_field_values FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_field_values_lead ON custom_lead_field_values(lead_id);
CREATE INDEX IF NOT EXISTS idx_field_values_user_field ON custom_lead_field_values(user_id, field_id);