-- Drop all Campaign Optimizer tables and related objects
-- These tables stored Meta Marketing API data for automatic ad budget optimization.
-- The feature was built but never wired into the frontend UI.

DROP TABLE IF EXISTS campaign_trends CASCADE;
DROP TABLE IF EXISTS campaign_alerts CASCADE;
DROP TABLE IF EXISTS optimization_logs CASCADE;
DROP TABLE IF EXISTS optimization_rules CASCADE;
DROP TABLE IF EXISTS campaign_snapshots CASCADE;
DROP TABLE IF EXISTS meta_marketing_settings CASCADE;