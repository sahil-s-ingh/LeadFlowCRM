/*
# Meta Ads Manager — Campaign Management Tables

## Purpose
Stores Meta Marketing API credentials and campaign/ad data so users can create, manage, 
and track Facebook/Instagram ad campaigns directly from the CRM without opening Facebook Ads Manager.

## New Tables

### 1. `meta_ads_settings`
Stores the user's Meta Marketing API credentials (separate from the Conversion API settings).
- `user_id` (uuid) — owner, defaults to auth.uid()
- `app_id` (text) — Meta App ID
- `app_secret` (text) — Meta App Secret  
- `access_token` (text) — long-lived access token for Marketing API
- `ad_account_id` (text) — the ad account ID (without "act_" prefix)
- `is_connected` (boolean) — whether the user has completed the connection
- `created_at`, `updated_at` (timestamptz)

### 2. `meta_ad_campaigns`
Stores campaigns created via the CRM's Ads Manager.
- `user_id` (uuid) — owner
- `meta_campaign_id` (text) — Meta's campaign ID once created
- `name` (text) — campaign name
- `objective` (text) — LINK_CLICKS, LEAD_GENERATION, MESSAGES, etc.
- `status` (text) — ACTIVE, PAUSED, DRAFT
- `buying_type` (text) — AUCTION or REACH_AND_FREQUENCY
- `daily_budget` (numeric) — daily budget in account currency
- `lifetime_budget` (numeric) — lifetime budget (optional)
- `currency` (text) — USD, INR, etc.
- `start_time` (timestamptz) — campaign start
- `stop_time` (timestamptz) — campaign end (optional)
- `spend` (numeric) — total spend (synced from Meta)
- `impressions` (bigint) — total impressions (synced)
- `clicks` (bigint) — total clicks (synced)
- `leads` (integer) — total leads (synced)
- `cpl` (numeric) — cost per lead (calculated)
- `ctr` (numeric) — click-through rate (calculated)
- `last_synced_at` (timestamptz) — when stats were last pulled
- `created_at`, `updated_at` (timestamptz)

### 3. `meta_ad_adsets`
Stores ad sets under campaigns (targeting & budget configuration).
- `user_id` (uuid) — owner
- `campaign_id` (uuid) — FK to meta_ad_campaigns
- `meta_adset_id` (text) — Meta's ad set ID
- `name` (text) — ad set name
- `status` (text) — ACTIVE, PAUSED
- `daily_budget` (numeric)
- `target_audience` (text) — audience description (broad, custom, lookalike)
- `geo_locations` (text[]) — countries/regions targeted
- `age_min` (integer), `age_max` (integer) — age range
- `gender` (text) — all, male, female
- `placements` (text) — automatic or manual config
- `optimization_goal` (text) — REACH, LINK_CLICKS, LEAD_GENERATION, etc.
- `created_at`, `updated_at` (timestamptz)

### 4. `meta_ad_ads`
Stores individual ads (creative + copy) under ad sets.
- `user_id` (uuid) — owner
- `adset_id` (uuid) — FK to meta_ad_adsets
- `meta_ad_id` (text) — Meta's ad ID
- `name` (text) — ad name
- `status` (text) — ACTIVE, PAUSED
- `ad_format` (text) — SINGLE_IMAGE, VIDEO, CAROUSEL
- `headline` (text) — ad headline
- `primary_text` (text) — ad body copy
- `description` (text) — link description
- `call_to_action` (text) — LEARN_MORE, SIGN_UP, CONTACT_US, etc.
- `website_url` (text) — destination URL for website ads
- `whatsapp_number` (text) — for click-to-WhatsApp ads
- `image_url` (text) — hosted image URL for the creative
- `lead_form_id` (text) — Meta lead form ID for lead form ads
- `created_at`, `updated_at` (timestamptz)

## Security
- RLS enabled on all tables, owner-scoped via auth.uid() = user_id
- All tables have user_id NOT NULL DEFAULT auth.uid()
- 4 separate policies per table (SELECT, INSERT, UPDATE, DELETE)
- Indexes on user_id and foreign keys for query performance
*/

-- ============================================================
-- 1. meta_ads_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ads_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  app_id text,
  app_secret text,
  access_token text,
  ad_account_id text,
  is_connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meta_ads_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ads_settings" ON meta_ads_settings;
CREATE POLICY "select_own_ads_settings" ON meta_ads_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ads_settings" ON meta_ads_settings;
CREATE POLICY "insert_own_ads_settings" ON meta_ads_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ads_settings" ON meta_ads_settings;
CREATE POLICY "update_own_ads_settings" ON meta_ads_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ads_settings" ON meta_ads_settings;
CREATE POLICY "delete_own_ads_settings" ON meta_ads_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ads_settings_user ON meta_ads_settings(user_id);

-- ============================================================
-- 2. meta_ad_campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  meta_campaign_id text,
  name text NOT NULL,
  objective text NOT NULL DEFAULT 'LINK_CLICKS',
  status text NOT NULL DEFAULT 'DRAFT',
  buying_type text NOT NULL DEFAULT 'AUCTION',
  daily_budget numeric,
  lifetime_budget numeric,
  currency text NOT NULL DEFAULT 'USD',
  start_time timestamptz,
  stop_time timestamptz,
  spend numeric DEFAULT 0,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  leads integer DEFAULT 0,
  cpl numeric,
  ctr numeric,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meta_ad_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ad_campaigns" ON meta_ad_campaigns;
CREATE POLICY "select_own_ad_campaigns" ON meta_ad_campaigns
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ad_campaigns" ON meta_ad_campaigns;
CREATE POLICY "insert_own_ad_campaigns" ON meta_ad_campaigns
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ad_campaigns" ON meta_ad_campaigns;
CREATE POLICY "update_own_ad_campaigns" ON meta_ad_campaigns
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ad_campaigns" ON meta_ad_campaigns;
CREATE POLICY "delete_own_ad_campaigns" ON meta_ad_campaigns
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_user ON meta_ad_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_meta_id ON meta_ad_campaigns(meta_campaign_id);

-- ============================================================
-- 3. meta_ad_adsets
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ad_adsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  campaign_id uuid REFERENCES meta_ad_campaigns(id) ON DELETE CASCADE,
  meta_adset_id text,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  daily_budget numeric,
  target_audience text NOT NULL DEFAULT 'broad',
  geo_locations text[] DEFAULT '{}',
  age_min integer DEFAULT 18,
  age_max integer DEFAULT 65,
  gender text NOT NULL DEFAULT 'all',
  placements text NOT NULL DEFAULT 'automatic',
  optimization_goal text NOT NULL DEFAULT 'REACH',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meta_ad_adsets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ad_adsets" ON meta_ad_adsets;
CREATE POLICY "select_own_ad_adsets" ON meta_ad_adsets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ad_adsets" ON meta_ad_adsets;
CREATE POLICY "insert_own_ad_adsets" ON meta_ad_adsets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ad_adsets" ON meta_ad_adsets;
CREATE POLICY "update_own_ad_adsets" ON meta_ad_adsets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ad_adsets" ON meta_ad_adsets;
CREATE POLICY "delete_own_ad_adsets" ON meta_ad_adsets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ad_adsets_user ON meta_ad_adsets(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_adsets_campaign ON meta_ad_adsets(campaign_id);

-- ============================================================
-- 4. meta_ad_ads
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ad_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  adset_id uuid REFERENCES meta_ad_adsets(id) ON DELETE CASCADE,
  meta_ad_id text,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  ad_format text NOT NULL DEFAULT 'SINGLE_IMAGE',
  headline text,
  primary_text text,
  description text,
  call_to_action text NOT NULL DEFAULT 'LEARN_MORE',
  website_url text,
  whatsapp_number text,
  image_url text,
  lead_form_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meta_ad_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ad_ads" ON meta_ad_ads;
CREATE POLICY "select_own_ad_ads" ON meta_ad_ads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ad_ads" ON meta_ad_ads;
CREATE POLICY "insert_own_ad_ads" ON meta_ad_ads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ad_ads" ON meta_ad_ads;
CREATE POLICY "update_own_ad_ads" ON meta_ad_ads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ad_ads" ON meta_ad_ads;
CREATE POLICY "delete_own_ad_ads" ON meta_ad_ads
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ad_ads_user ON meta_ad_ads(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_ads_adset ON meta_ad_ads(adset_id);