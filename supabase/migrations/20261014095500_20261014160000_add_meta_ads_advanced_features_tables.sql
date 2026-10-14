/*
# Meta Ads Manager Advanced Features

1. New Tables
- `meta_custom_audiences` — stores custom audiences created from CRM leads, synced with Meta
- `meta_lookalike_audiences` — stores lookalike audiences derived from custom audiences
- `meta_lead_forms` — stores Facebook/Instagram lead form ad configurations
- `meta_lead_form_leads` — stores leads collected from Meta lead form ads
- `meta_ad_attribution` — links CRM submissions to specific Meta campaigns for revenue tracking

2. Columns
- meta_custom_audiences: id, user_id, name, description, audience_id (Meta's ID), audience_type, estimated_size, status, last_synced_at, created_at, updated_at
- meta_lookalike_audiences: id, user_id, name, source_audience_id, lookalike_audience_id (Meta's ID), audience_size, country, status, created_at
- meta_lead_forms: id, user_id, name, page_id, form_id (Meta's ID), questions JSONB, privacy_policy_url, status, leads_count, created_at, updated_at
- meta_lead_form_leads: id, user_id, form_id, lead_id (Meta's leadgen ID), field_data JSONB, created_at, synced_to_crm boolean
- meta_ad_attribution: id, user_id, submission_id, meta_campaign_id, campaign_name, lead_source, attributed_revenue, attributed_at

3. Security
- All tables have RLS enabled with owner-scoped CRUD policies (authenticated, auth.uid() = user_id)
- user_id columns default to auth.uid()

4. Notes
- Indexes on user_id for all tables
- meta_ad_attribution has unique constraint on submission_id to prevent duplicate attribution
*/

-- Custom Audiences
CREATE TABLE IF NOT EXISTS meta_custom_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  audience_id text,
  audience_type text NOT NULL DEFAULT 'CUSTOM',
  estimated_size bigint,
  status text NOT NULL DEFAULT 'DRAFT',
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE meta_custom_audiences ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_meta_custom_audiences_user_id ON meta_custom_audiences(user_id);
DROP POLICY IF EXISTS "select_own_meta_custom_audiences" ON meta_custom_audiences;
CREATE POLICY "select_own_meta_custom_audiences" ON meta_custom_audiences FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meta_custom_audiences" ON meta_custom_audiences;
CREATE POLICY "insert_own_meta_custom_audiences" ON meta_custom_audiences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meta_custom_audiences" ON meta_custom_audiences;
CREATE POLICY "update_own_meta_custom_audiences" ON meta_custom_audiences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meta_custom_audiences" ON meta_custom_audiences;
CREATE POLICY "delete_own_meta_custom_audiences" ON meta_custom_audiences FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Lookalike Audiences
CREATE TABLE IF NOT EXISTS meta_lookalike_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_audience_id text,
  lookalike_audience_id text,
  audience_size text,
  country text DEFAULT 'US',
  status text NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE meta_lookalike_audiences ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_meta_lookalike_audiences_user_id ON meta_lookalike_audiences(user_id);
DROP POLICY IF EXISTS "select_own_meta_lookalike_audiences" ON meta_lookalike_audiences;
CREATE POLICY "select_own_meta_lookalike_audiences" ON meta_lookalike_audiences FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meta_lookalike_audiences" ON meta_lookalike_audiences;
CREATE POLICY "insert_own_meta_lookalike_audiences" ON meta_lookalike_audiences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meta_lookalike_audiences" ON meta_lookalike_audiences;
CREATE POLICY "update_own_meta_lookalike_audiences" ON meta_lookalike_audiences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meta_lookalike_audiences" ON meta_lookalike_audiences;
CREATE POLICY "delete_own_meta_lookalike_audiences" ON meta_lookalike_audiences FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Lead Forms
CREATE TABLE IF NOT EXISTS meta_lead_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  page_id text,
  form_id text,
  questions jsonb DEFAULT '[]'::jsonb,
  privacy_policy_url text,
  status text NOT NULL DEFAULT 'DRAFT',
  leads_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE meta_lead_forms ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_meta_lead_forms_user_id ON meta_lead_forms(user_id);
DROP POLICY IF EXISTS "select_own_meta_lead_forms" ON meta_lead_forms;
CREATE POLICY "select_own_meta_lead_forms" ON meta_lead_forms FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meta_lead_forms" ON meta_lead_forms;
CREATE POLICY "insert_own_meta_lead_forms" ON meta_lead_forms FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meta_lead_forms" ON meta_lead_forms;
CREATE POLICY "update_own_meta_lead_forms" ON meta_lead_forms FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meta_lead_forms" ON meta_lead_forms;
CREATE POLICY "delete_own_meta_lead_forms" ON meta_lead_forms FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Lead Form Leads (collected from Meta lead form ads)
CREATE TABLE IF NOT EXISTS meta_lead_form_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id text,
  leadgen_id text,
  field_data jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  synced_to_crm boolean NOT NULL DEFAULT false
);
ALTER TABLE meta_lead_form_leads ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_meta_lead_form_leads_user_id ON meta_lead_form_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_lead_form_leads_form_id ON meta_lead_form_leads(form_id);
DROP POLICY IF EXISTS "select_own_meta_lead_form_leads" ON meta_lead_form_leads;
CREATE POLICY "select_own_meta_lead_form_leads" ON meta_lead_form_leads FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meta_lead_form_leads" ON meta_lead_form_leads;
CREATE POLICY "insert_own_meta_lead_form_leads" ON meta_lead_form_leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meta_lead_form_leads" ON meta_lead_form_leads;
CREATE POLICY "update_own_meta_lead_form_leads" ON meta_lead_form_leads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meta_lead_form_leads" ON meta_lead_form_leads;
CREATE POLICY "delete_own_meta_lead_form_leads" ON meta_lead_form_leads FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Ad Attribution (links CRM leads to Meta campaigns)
CREATE TABLE IF NOT EXISTS meta_ad_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES submissions(id) ON DELETE CASCADE,
  meta_campaign_id text,
  campaign_name text,
  lead_source text,
  attributed_revenue numeric DEFAULT 0,
  attributed_at timestamptz DEFAULT now()
);
ALTER TABLE meta_ad_attribution ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_meta_ad_attribution_user_id ON meta_ad_attribution(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_ad_attribution_submission_id ON meta_ad_attribution(submission_id) WHERE submission_id IS NOT NULL;
DROP POLICY IF EXISTS "select_own_meta_ad_attribution" ON meta_ad_attribution;
CREATE POLICY "select_own_meta_ad_attribution" ON meta_ad_attribution FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meta_ad_attribution" ON meta_ad_attribution;
CREATE POLICY "insert_own_meta_ad_attribution" ON meta_ad_attribution FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meta_ad_attribution" ON meta_ad_attribution;
CREATE POLICY "update_own_meta_ad_attribution" ON meta_ad_attribution FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meta_ad_attribution" ON meta_ad_attribution;
CREATE POLICY "delete_own_meta_ad_attribution" ON meta_ad_attribution FOR DELETE TO authenticated USING (auth.uid() = user_id);
