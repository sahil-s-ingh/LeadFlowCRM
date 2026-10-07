/*
# Create Popup Form Builder tables

## Purpose
Allows CRM users to build custom popup forms that appear on the landing page.
Visitors fill them out and the data flows into the existing submissions (leads) table.

## New Tables

### popup_forms
Stores form definitions created by the CRM user.
- id (uuid, PK)
- user_id (uuid, FK to auth.users, defaults to auth.uid())
- name (text) — internal label for the form
- title (text) — headline shown in the popup modal
- subtitle (text) — subtext under the title
- fields (jsonb) — ordered array of field definitions:
  [{ id, type, label, placeholder, required, options?, mapsTo }]
  where type = text|email|tel|select|textarea|number|checkbox
  and mapsTo = full_name|mobile_number|email|state|trading_product|fund_amount|custom
- trigger_type (text) — time_delay|scroll|exit_intent|immediate
- trigger_value (int) — seconds for time_delay, percentage for scroll
- button_text (text) — CTA button label
- button_bg_color (text) — hex color for the submit button
- button_text_color (text) — hex color for button text
- is_active (boolean) — whether the form is live on the landing page
- created_at, updated_at (timestamptz)

### Modified Tables

#### submissions
- Added custom_data (jsonb, nullable) column to store values from custom form fields
  that don't map to the standard columns (full_name, mobile_number, email, etc.)

## Security
- popup_forms: RLS enabled. Authenticated users get full CRUD on their own forms.
  Anon role gets SELECT on active forms only (so the landing page can fetch them).
- submissions: existing anon INSERT policy already covers popup form submissions.
  Added anon SELECT on popup_forms WHERE is_active = true.

## Important Notes
1. The popup_forms table uses user_id DEFAULT auth.uid() so inserts from the
   authenticated client work without explicitly passing user_id.
2. Anon can only read active forms — they cannot create, edit, or delete forms.
3. Custom field values are stored in submissions.custom_data as a JSON object.
*/

-- Create popup_forms table
CREATE TABLE IF NOT EXISTS popup_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Form',
  title text NOT NULL DEFAULT 'Get Free Access',
  subtitle text NOT NULL DEFAULT 'Fill in your details to continue',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  trigger_type text NOT NULL DEFAULT 'time_delay',
  trigger_value int NOT NULL DEFAULT 5,
  button_text text NOT NULL DEFAULT 'Submit',
  button_bg_color text NOT NULL DEFAULT '#0f766e',
  button_text_color text NOT NULL DEFAULT '#ffffff',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE popup_forms ENABLE ROW LEVEL SECURITY;

-- Authenticated: full CRUD on own forms
DROP POLICY IF EXISTS "select_own_popup_forms" ON popup_forms;
CREATE POLICY "select_own_popup_forms" ON popup_forms FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_popup_forms" ON popup_forms;
CREATE POLICY "insert_own_popup_forms" ON popup_forms FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_popup_forms" ON popup_forms;
CREATE POLICY "update_own_popup_forms" ON popup_forms FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_popup_forms" ON popup_forms;
CREATE POLICY "delete_own_popup_forms" ON popup_forms FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Anon: can read active forms (for landing page rendering)
DROP POLICY IF EXISTS "anon_read_active_popup_forms" ON popup_forms;
CREATE POLICY "anon_read_active_popup_forms" ON popup_forms FOR SELECT
  TO anon USING (is_active = true);

-- Add custom_data column to submissions for extra form fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'custom_data'
  ) THEN
    ALTER TABLE submissions ADD COLUMN custom_data jsonb;
  END IF;
END $$;

-- Create index for popup_forms lookups
CREATE INDEX IF NOT EXISTS idx_popup_forms_user_id ON popup_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_popup_forms_active ON popup_forms(is_active) WHERE is_active = true;
