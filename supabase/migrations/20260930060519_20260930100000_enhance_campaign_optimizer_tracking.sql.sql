/*
# Campaign Optimizer — Enhanced Tracking Accuracy

## Purpose
Adds columns and tables to track campaign performance more accurately:
- Ad-level breakdown (not just adset level)
- Daily budget and buying strategy for budget pacing
- Cost per conversion and profit/loss tracking
- Campaign health score (composite metric)
- Trend tracking (period-over-period comparison)
- Alert notifications for performance issues

## Changes to existing tables

### `campaign_snapshots` — new columns
- `ad_id` (text) — Meta ad ID for ad-level tracking
- `ad_name` (text) — Meta ad name
- `daily_budget` (numeric) — campaign daily budget at snapshot time
- `lifetime_budget` (numeric) — campaign lifetime budget at snapshot time
- `buying_strategy` (text) — auction strategy from Meta
- `objective` (text) — campaign objective (e.g. LEAD_GENERATION)
- `campaign_status` (text) — ACTIVE, PAUSED, etc.
- `cost_per_conversion` (numeric) — spend / conversions
- `profit_loss` (numeric) — revenue - spend
- `health_score` (numeric) — 0-100 composite score combining CPL, ROAS, lead quality, and conversion rate
- `frequency` (numeric) — average frequency from Meta
- `cpm` (numeric) — cost per 1000 impressions
- `cost_per_click` (numeric) — spend / clicks
- `lead_to_conversion_rate` (numeric) — conversions / leads * 100

### `meta_marketing_settings` — new columns
- `alert_email` (text) — email to send performance alerts to
- `alert_on_high_cpl` (boolean) — alert when CPL exceeds target
- `alert_on_low_roas` (boolean) — alert when ROAS is below target
- `alert_on_paused_campaign` (boolean) — alert when a campaign gets auto-paused
- `sync_frequency` (text) — how often to auto-sync: 'hourly', 'daily', 'weekly'
- `last_synced_at` (timestamptz) — when data was last synced

## New table: `campaign_alerts`
Stores performance alert notifications.
- `id` (uuid, primary key)
- `user_id` (uuid, owner)
- `campaign_id` (text) — affected campaign
- `campaign_name` (text)
- `alert_type` (text) — 'high_cpl', 'low_roas', 'low_quality', 'paused', 'no_conversions', 'budget_exhausted'
- `severity` (text) — 'info', 'warning', 'critical'
- `message` (text) — human-readable alert message
- `metric_value` (numeric) — the value that triggered the alert
- `threshold_value` (numeric) — the threshold it crossed
- `is_read` (boolean, default false)
- `is_resolved` (boolean, default false)
- `created_at` (timestamptz)

## New table: `campaign_trends`
Stores aggregated daily/weekly trend data for charts.
- `id` (uuid, primary key)
- `user_id` (uuid, owner)
- `period_date` (date) — the date this trend covers
- `period_type` (text) — 'daily' or 'weekly'
- `total_spend` (numeric)
- `total_leads` (integer)
- `total_conversions` (integer)
- `total_revenue` (numeric)
- `avg_cpl` (numeric)
- `avg_roas` (numeric)
- `avg_ctr` (numeric)
- `avg_health_score` (numeric)
- `total_impressions` (bigint)
- `total_clicks` (bigint)
- `created_at` (timestamptz)

## Security
- RLS enabled on all new tables, owner-scoped via auth.uid() = user_id
- 4 separate policies per table (SELECT, INSERT, UPDATE, DELETE)
- Indexes on user_id, campaign_id, and period_date for query performance
*/

-- ============================================================
-- 1. Add columns to campaign_snapshots
-- ============================================================
ALTER TABLE campaign_snapshots
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS daily_budget numeric,
  ADD COLUMN IF NOT EXISTS lifetime_budget numeric,
  ADD COLUMN IF NOT EXISTS buying_strategy text,
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS campaign_status text,
  ADD COLUMN IF NOT EXISTS cost_per_conversion numeric,
  ADD COLUMN IF NOT EXISTS profit_loss numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequency numeric,
  ADD COLUMN IF NOT EXISTS cpm numeric,
  ADD COLUMN IF NOT EXISTS cost_per_click numeric,
  ADD COLUMN IF NOT EXISTS lead_to_conversion_rate numeric;

CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_adset ON campaign_snapshots(adset_id);
CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_user_date ON campaign_snapshots(user_id, snapshot_date);

-- ============================================================
-- 2. Add columns to meta_marketing_settings
-- ============================================================
ALTER TABLE meta_marketing_settings
  ADD COLUMN IF NOT EXISTS alert_email text,
  ADD COLUMN IF NOT EXISTS alert_on_high_cpl boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_on_low_roas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_on_paused_campaign boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_frequency text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- ============================================================
-- 3. Create campaign_alerts table
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  campaign_id text NOT NULL,
  campaign_name text,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  metric_value numeric,
  threshold_value numeric,
  is_read boolean NOT NULL DEFAULT false,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaign_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_campaign_alerts" ON campaign_alerts;
CREATE POLICY "select_own_campaign_alerts" ON campaign_alerts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_campaign_alerts" ON campaign_alerts;
CREATE POLICY "insert_own_campaign_alerts" ON campaign_alerts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_campaign_alerts" ON campaign_alerts;
CREATE POLICY "update_own_campaign_alerts" ON campaign_alerts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_campaign_alerts" ON campaign_alerts;
CREATE POLICY "delete_own_campaign_alerts" ON campaign_alerts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_campaign_alerts_user ON campaign_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_alerts_unread ON campaign_alerts(user_id, is_read) WHERE is_read = false;

-- ============================================================
-- 4. Create campaign_trends table
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  period_date date NOT NULL,
  period_type text NOT NULL DEFAULT 'daily',
  total_spend numeric DEFAULT 0,
  total_leads integer DEFAULT 0,
  total_conversions integer DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  avg_cpl numeric,
  avg_roas numeric,
  avg_ctr numeric,
  avg_health_score numeric,
  total_impressions bigint DEFAULT 0,
  total_clicks bigint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaign_trends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_campaign_trends" ON campaign_trends;
CREATE POLICY "select_own_campaign_trends" ON campaign_trends
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_campaign_trends" ON campaign_trends;
CREATE POLICY "insert_own_campaign_trends" ON campaign_trends
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_campaign_trends" ON campaign_trends;
CREATE POLICY "update_own_campaign_trends" ON campaign_trends
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_campaign_trends" ON campaign_trends;
CREATE POLICY "delete_own_campaign_trends" ON campaign_trends
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_campaign_trends_user_date ON campaign_trends(user_id, period_date);
CREATE INDEX IF NOT EXISTS idx_campaign_trends_type ON campaign_trends(period_type);

-- ============================================================
-- 5. Add 'health_score' to optimization_rules metric check constraint
--    (no constraint exists, but we document it here)
-- ============================================================
-- The metric column already accepts any text, so 'health_score' works
-- without a schema change. The edge function will handle it.

-- ============================================================
-- 6. Enable realtime for campaign_alerts
-- ============================================================
ALTER TABLE campaign_alerts REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'campaign_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE campaign_alerts;
  END IF;
END
$$;