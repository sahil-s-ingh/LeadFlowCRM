/*
# Create API Integration Settings Table

1. New Tables
- `api_integration_settings`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to authenticated user, references auth.users)
  - `google_maps_api_key` (text, nullable) — Google Maps/Places API key for location autocomplete
  - `razorpay_key_id` (text, nullable) — Razorpay payment gateway key ID
  - `razorpay_key_secret` (text, nullable) — Razorpay payment gateway secret
  - `stripe_secret_key` (text, nullable) — Stripe secret key for payments
  - `stripe_publishable_key` (text, nullable) — Stripe publishable key for frontend
  - `openai_api_key` (text, nullable) — OpenAI API key for AI features
  - `sendgrid_api_key` (text, nullable) — SendGrid email API key
  - `twilio_api_key_sid` (text, nullable) — Twilio API Key SID (alternative to Account SID)
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

2. Security
- Enable RLS on `api_integration_settings`.
- Owner-scoped CRUD: each authenticated user can only access their own row.
- 4 separate policies: SELECT, INSERT, UPDATE, DELETE — all scoped to `auth.uid() = user_id`.
- `user_id` defaults to `auth.uid()` so inserts that omit it still satisfy the WITH CHECK.
*/

CREATE TABLE IF NOT EXISTS api_integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  google_maps_api_key text,
  razorpay_key_id text,
  razorpay_key_secret text,
  stripe_secret_key text,
  stripe_publishable_key text,
  openai_api_key text,
  sendgrid_api_key text,
  twilio_api_key_sid text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE api_integration_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_api_integrations" ON api_integration_settings;
CREATE POLICY "select_own_api_integrations"
  ON api_integration_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_api_integrations" ON api_integration_settings;
CREATE POLICY "insert_own_api_integrations"
  ON api_integration_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_api_integrations" ON api_integration_settings;
CREATE POLICY "update_own_api_integrations"
  ON api_integration_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_api_integrations" ON api_integration_settings;
CREATE POLICY "delete_own_api_integrations"
  ON api_integration_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
