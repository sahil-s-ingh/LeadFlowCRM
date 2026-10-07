/*
# Campaign Optimizer — Meta Marketing API Integration

## Purpose
Enables automatic campaign optimization by fetching performance data from Meta's Marketing API
(spend, impressions, clicks, CPL, ROAS per campaign/ad set) and applying budget reallocation
rules based on lead-quality signals from the CRM pipeline.

## New Tables

### 1. `meta_marketing_settings`
Stores the Meta Marketing API credentials (separate from the CAPI pixel settings).
- `user_id` (uuid) — owner, defaults to auth.uid()
- `app_id` (text) — Meta App ID
- `app_secret` (text) — Meta App Secret
- `access_token` (text) — long-lived access token for Marketing API
- `ad_account_id` (text) — the ad account ID (without the "act_" prefix)
- `is_enabled` (boolean) — master toggle
- `auto_optimize` (boolean) — whether automatic budget reallocation is on
- `optimization_frequency` (text) — 'hourly' | 'daily' | 'weekly'
- `min_spend_threshold` (numeric) — minimum daily spend to be eligible for optimization
- `max_budget_change_pct` (numeric) — max % a single optimization step can change a budget (default 20)
- `target_cpl` (numeric) — target cost per lead
- `target_roas` (numeric) — target return on ad spend

### 2. `campaign_snapshots`
Stores periodic performance snapshots for each campaign/ad set.
- `user_id` (uuid) — owner
- `campaign_id` (text) — Meta campaign ID
- `campaign_name` (text) — campaign name
- `adset_id` (text) — Meta ad set ID (nullable)
- `adset_name` (text) — ad set name (nullable)
- `snapshot_date` (date) — the date this snapshot covers
- `spend` (numeric) — amount spent
- `impressions` (bigint) — impressions
- `clicks` (bigint) — link clicks
- `reach` (bigint) — reach
- `leads` (integer) — number of leads (from CRM, matched by campaign)
- `conversions` (integer) — number of converted leads from CRM
- `revenue` (numeric) — revenue from converted leads (fund_amount + setup_cost)
- `cpl` (numeric) — cost per lead (calculated)
- `ctr` (numeric) — click-through rate (calculated)
- `roas` (numeric) — return on ad spend (calculated)
- `lead_quality_score` (numeric) — 0-100 score based on conversion rate
- `created_at` (timestamptz)

### 3. `optimization_rules`
User-defined rules for automatic budget reallocation.
- `user_id` (uuid) — owner
- `name` (text) — rule name
- `metric` (text) — 'cpl' | 'roas' | 'lead_quality' | 'conversions'
- `condition` (text) — 'below' | 'above'
- `threshold` (numeric) — threshold value
- `action` (text) — 'increase_budget' | 'decrease_budget' | 'pause' | 'notify'
- `change_pct` (numeric) — percentage to change budget by (for increase/decrease actions)
- `is_active` (boolean) — whether the rule is enabled
- `created_at` (timestamptz)

### 4. `optimization_logs`
Audit trail of optimization actions taken.
- `user_id` (uuid) — owner
- `rule_id` (uuid) — which rule triggered
- `rule_name` (text) — rule name (snapshot for history)
- `campaign_id` (text) — affected campaign
- `campaign_name` (text) — affected campaign name
- `action_taken` (text) — what was done
- `old_budget` (numeric)
- `new_budget` (numeric)
- `metric_value` (numeric) — the metric value that triggered the rule
- `success` (boolean)
- `error_message` (text)
- `created_at` (timestamptz)

## Security
- RLS enabled on all tables, owner-scoped via auth.uid() = user_id
- All tables have user_id NOT NULL DEFAULT auth.uid()
- 4 separate policies per table (SELECT, INSERT, UPDATE, DELETE)
- Indexes on user_id and campaign_id for query performance
*/

-- ============================================================
-- 1. meta_marketing_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_marketing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  app_id text,
  app_secret text,
  access_token text NOT NULL,
  ad_account_id text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  auto_optimize boolean NOT NULL DEFAULT false,
  optimization_frequency text NOT NULL DEFAULT 'daily',
  min_spend_threshold numeric NOT NULL DEFAULT 50,
  max_budget_change_pct numeric NOT NULL DEFAULT 20,
  target_cpl numeric,
  target_roas numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meta_marketing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_marketing_settings" ON meta_marketing_settings;
CREATE POLICY "select_own_marketing_settings" ON meta_marketing_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_marketing_settings" ON meta_marketing_settings;
CREATE POLICY "insert_own_marketing_settings" ON meta_marketing_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_marketing_settings" ON meta_marketing_settings;
CREATE POLICY "update_own_marketing_settings" ON meta_marketing_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_marketing_settings" ON meta_marketing_settings;
CREATE POLICY "delete_own_marketing_settings" ON meta_marketing_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_settings_user ON meta_marketing_settings(user_id);

-- ============================================================
-- 2. campaign_snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  campaign_id text NOT NULL,
  campaign_name text,
  adset_id text,
  adset_name text,
  snapshot_date date NOT NULL,
  spend numeric DEFAULT 0,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  reach bigint DEFAULT 0,
  leads integer DEFAULT 0,
  conversions integer DEFAULT 0,
  revenue numeric DEFAULT 0,
  cpl numeric,
  ctr numeric,
  roas numeric,
  lead_quality_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaign_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_campaign_snapshots" ON campaign_snapshots;
CREATE POLICY "select_own_campaign_snapshots" ON campaign_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_campaign_snapshots" ON campaign_snapshots;
CREATE POLICY "insert_own_campaign_snapshots" ON campaign_snapshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_campaign_snapshots" ON campaign_snapshots;
CREATE POLICY "update_own_campaign_snapshots" ON campaign_snapshots
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_campaign_snapshots" ON campaign_snapshots;
CREATE POLICY "delete_own_campaign_snapshots" ON campaign_snapshots
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_user ON campaign_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_campaign ON campaign_snapshots(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_date ON campaign_snapshots(snapshot_date);

-- ============================================================
-- 3. optimization_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS optimization_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  metric text NOT NULL DEFAULT 'cpl',
  condition text NOT NULL DEFAULT 'below',
  threshold numeric NOT NULL DEFAULT 0,
  action text NOT NULL DEFAULT 'notify',
  change_pct numeric DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE optimization_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_opt_rules" ON optimization_rules;
CREATE POLICY "select_own_opt_rules" ON optimization_rules
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_opt_rules" ON optimization_rules;
CREATE POLICY "insert_own_opt_rules" ON optimization_rules
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_opt_rules" ON optimization_rules;
CREATE POLICY "update_own_opt_rules" ON optimization_rules
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_opt_rules" ON optimization_rules;
CREATE POLICY "delete_own_opt_rules" ON optimization_rules
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_opt_rules_user ON optimization_rules(user_id);

-- ============================================================
-- 4. optimization_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS optimization_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  rule_id uuid,
  rule_name text,
  campaign_id text,
  campaign_name text,
  action_taken text,
  old_budget numeric,
  new_budget numeric,
  metric_value numeric,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE optimization_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_opt_logs" ON optimization_logs;
CREATE POLICY "select_own_opt_logs" ON optimization_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_opt_logs" ON optimization_logs;
CREATE POLICY "insert_own_opt_logs" ON optimization_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_opt_logs" ON optimization_logs;
CREATE POLICY "update_own_opt_logs" ON optimization_logs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_opt_logs" ON optimization_logs;
CREATE POLICY "delete_own_opt_logs" ON optimization_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_opt_logs_user ON optimization_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_opt_logs_created ON optimization_logs(created_at);