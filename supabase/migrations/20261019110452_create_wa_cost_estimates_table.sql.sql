/*
# WhatsApp Broadcast Cost Estimates

## What this does
1. Creates `wa_cost_estimates` table — saved cost estimates from the Message Cost
   Calculator so finance teams can reference them later.
2. Each estimate stores the inputs (message count, cost-per-message, currency,
   conversation window mode, tier label) and the computed total.
3. Optionally links to a broadcast campaign via `campaign_id`.
4. Enables RLS with owner-scoped CRUD (user_id defaults to auth.uid()).

## New Tables
### wa_cost_estimates
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), FK to auth.users ON DELETE CASCADE)
- `label` (text, not null) — friendly name for the estimate
- `message_count` (int, not null)
- `cost_per_message` (numeric, not null)
- `currency` (text, not null, default 'USD')
- `tier_label` (text, nullable) — e.g. "India Marketing"
- `conversation_window` (text, not null, default 'new') — 'new' or 'existing'
- `estimated_total` (numeric, not null)
- `campaign_id` (uuid, nullable, FK to wa_broadcast_campaigns ON DELETE SET NULL)
- `notes` (text, nullable)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

## Security
- Owner-scoped CRUD: each authenticated user can only access their own saved estimates.
- user_id defaults to auth.uid() so inserts that omit it still satisfy the WITH CHECK.

## Notes
1. Idempotent — safe to re-run.
2. Deleting a campaign sets campaign_id to NULL rather than deleting the estimate.
*/

CREATE TABLE IF NOT EXISTS wa_cost_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  message_count int NOT NULL DEFAULT 0,
  cost_per_message numeric(12,6) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  tier_label text,
  conversation_window text NOT NULL DEFAULT 'new',
  estimated_total numeric(14,4) NOT NULL DEFAULT 0,
  campaign_id uuid REFERENCES wa_broadcast_campaigns(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wa_cost_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_cost_estimates" ON wa_cost_estimates;
CREATE POLICY "select_own_cost_estimates" ON wa_cost_estimates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_cost_estimates" ON wa_cost_estimates;
CREATE POLICY "insert_own_cost_estimates" ON wa_cost_estimates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_cost_estimates" ON wa_cost_estimates;
CREATE POLICY "update_own_cost_estimates" ON wa_cost_estimates FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_cost_estimates" ON wa_cost_estimates;
CREATE POLICY "delete_own_cost_estimates" ON wa_cost_estimates FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_cost_estimates_user_id ON wa_cost_estimates(user_id);
