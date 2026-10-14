/*
# Add Meta Ads workspace features

1. Purpose
- Extends the Meta Ads Manager with persistent audience planning, creative reuse, imported lead tracking, reporting preferences, performance alerts, and an activity trail.
- All records are scoped to the signed-in CRM user.

2. New tables
- `meta_ad_audiences`: saved targeting plans with location, age, gender, placements, and audience type.
- `meta_ad_creatives`: reusable image/video creative and copy library.
- `meta_ad_leads`: leads imported from Meta lead forms and linked to campaigns when available.
- `meta_ad_reports`: scheduled report preferences and delivery settings.
- `meta_ad_alerts`: user-defined performance alert rules and their latest trigger state.
- `meta_ad_activity`: append-only user activity history for Ads Manager actions.

3. Security
- RLS is enabled on every table.
- Authenticated users can only access rows whose `user_id` matches their session.
- Each table has separate SELECT, INSERT, UPDATE, and DELETE policies.
- `user_id` defaults to `auth.uid()` so ownership is assigned by the database.

4. Important notes
- No existing tables, columns, or user data are removed or changed.
- Foreign keys use existing campaign records where available and set NULL on campaign deletion for imported leads and activity records.
*/

CREATE TABLE IF NOT EXISTS meta_ad_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  audience_type text NOT NULL DEFAULT 'saved',
  description text,
  locations text[] NOT NULL DEFAULT '{}',
  age_min integer NOT NULL DEFAULT 18,
  age_max integer NOT NULL DEFAULT 65,
  gender text NOT NULL DEFAULT 'all',
  interests text[] NOT NULL DEFAULT '{}',
  placements text NOT NULL DEFAULT 'automatic',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meta_ad_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  format text NOT NULL DEFAULT 'image',
  image_url text,
  video_url text,
  headline text,
  primary_text text,
  description text,
  call_to_action text NOT NULL DEFAULT 'LEARN_MORE',
  destination_url text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meta_ad_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_lead_id text,
  campaign_id uuid REFERENCES meta_ad_campaigns(id) ON DELETE SET NULL,
  form_id text,
  full_name text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'new',
  raw_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, meta_lead_id)
);

CREATE TABLE IF NOT EXISTS meta_ad_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  frequency text NOT NULL DEFAULT 'weekly',
  recipient_emails text[] NOT NULL DEFAULT '{}',
  date_range text NOT NULL DEFAULT 'last_7d',
  is_enabled boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meta_ad_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  metric text NOT NULL DEFAULT 'cpl',
  operator text NOT NULL DEFAULT 'greater_than',
  threshold numeric NOT NULL DEFAULT 0,
  campaign_id uuid REFERENCES meta_ad_campaigns(id) ON DELETE SET NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meta_ad_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES meta_ad_campaigns(id) ON DELETE SET NULL,
  action text NOT NULL,
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meta_ad_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ad_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ad_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ad_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ad_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meta_ad_audiences" ON meta_ad_audiences;
CREATE POLICY "select_own_meta_ad_audiences" ON meta_ad_audiences FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meta_ad_audiences" ON meta_ad_audiences;
CREATE POLICY "insert_own_meta_ad_audiences" ON meta_ad_audiences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meta_ad_audiences" ON meta_ad_audiences;
CREATE POLICY "update_own_meta_ad_audiences" ON meta_ad_audiences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meta_ad_audiences" ON meta_ad_audiences;
CREATE POLICY "delete_own_meta_ad_audiences" ON meta_ad_audiences FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_meta_ad_creatives" ON meta_ad_creatives;
CREATE POLICY "select_own_meta_ad_creatives" ON meta_ad_creatives FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meta_ad_creatives" ON meta_ad_creatives;
CREATE POLICY "insert_own_meta_ad_creatives" ON meta_ad_creatives FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meta_ad_creatives" ON meta_ad_creatives;
CREATE POLICY "update_own_meta_ad_creatives" ON meta_ad_creatives FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meta_ad_creatives" ON meta_ad_creatives;
CREATE POLICY "delete_own_meta_ad_creatives" ON meta_ad_creatives FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_meta_ad_leads" ON meta_ad_leads;
CREATE POLICY "select_own_meta_ad_leads" ON meta_ad_leads FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meta_ad_leads" ON meta_ad_leads;
CREATE POLICY "insert_own_meta_ad_leads" ON meta_ad_leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meta_ad_leads" ON meta_ad_leads;
CREATE POLICY "update_own_meta_ad_leads" ON meta_ad_leads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meta_ad_leads" ON meta_ad_leads;
CREATE POLICY "delete_own_meta_ad_leads" ON meta_ad_leads FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_meta_ad_reports" ON meta_ad_reports;
CREATE POLICY "select_own_meta_ad_reports" ON meta_ad_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meta_ad_reports" ON meta_ad_reports;
CREATE POLICY "insert_own_meta_ad_reports" ON meta_ad_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meta_ad_reports" ON meta_ad_reports;
CREATE POLICY "update_own_meta_ad_reports" ON meta_ad_reports FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meta_ad_reports" ON meta_ad_reports;
CREATE POLICY "delete_own_meta_ad_reports" ON meta_ad_reports FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_meta_ad_alerts" ON meta_ad_alerts;
CREATE POLICY "select_own_meta_ad_alerts" ON meta_ad_alerts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meta_ad_alerts" ON meta_ad_alerts;
CREATE POLICY "insert_own_meta_ad_alerts" ON meta_ad_alerts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meta_ad_alerts" ON meta_ad_alerts;
CREATE POLICY "update_own_meta_ad_alerts" ON meta_ad_alerts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meta_ad_alerts" ON meta_ad_alerts;
CREATE POLICY "delete_own_meta_ad_alerts" ON meta_ad_alerts FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_meta_ad_activity" ON meta_ad_activity;
CREATE POLICY "select_own_meta_ad_activity" ON meta_ad_activity FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meta_ad_activity" ON meta_ad_activity;
CREATE POLICY "insert_own_meta_ad_activity" ON meta_ad_activity FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meta_ad_activity" ON meta_ad_activity;
CREATE POLICY "update_own_meta_ad_activity" ON meta_ad_activity FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meta_ad_activity" ON meta_ad_activity;
CREATE POLICY "delete_own_meta_ad_activity" ON meta_ad_activity FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_meta_ad_audiences_user ON meta_ad_audiences(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_creatives_user ON meta_ad_creatives(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_leads_user ON meta_ad_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_leads_campaign ON meta_ad_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_reports_user ON meta_ad_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_alerts_user ON meta_ad_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_activity_user_created ON meta_ad_activity(user_id, created_at DESC);