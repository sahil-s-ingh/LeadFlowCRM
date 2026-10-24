/*
# Create WhatsApp Blue Tick (Official Business Account) Application Table

## Purpose
Allows CRM users to apply for the WhatsApp Official Business Account (OBA) verification —
the "green badge" / "blue tick" that appears next to a business name on WhatsApp.
This table stores the application data and tracks the verification status.

## New Tables
- `wa_blue_tick_applications`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid() — owner of the application)
  - `business_name` (text, not null — the legal business name)
  - `business_display_name` (text, not null — the display name shown on WhatsApp)
  - `business_category` (text, not null — e.g. "Financial Services", "Retail", etc.)
  - `business_description` (text, not null — what the business does)
  - `website_url` (text — company website)
  - `business_email` (text, not null — official business email for verification)
  - `business_phone` (text, not null — official business phone)
  - `address_line1` (text, not null — street address)
  - `address_city` (text, not null — city)
  - `address_state` (text — state/province)
  - `address_country` (text, not null — country)
  - `address_postal_code` (text — postal/zip code)
  - `waba_id` (text — WhatsApp Business Account ID, optional)
  - `phone_number_id` (text — WhatsApp phone number ID being verified, optional)
  - `documents_provided` (text[] — list of document types submitted, e.g. ['business_license', 'utility_bill'])
  - `status` (text, not null, default 'draft' — one of: draft, submitted, in_review, approved, rejected, resubmit)
  - `meta_application_id` (text — ID returned by Meta's API after submission)
  - `meta_verification_status` (text — raw status from Meta's API)
  - `rejection_reason` (text — reason if rejected)
  - `submitted_at` (timestamptz — when the application was submitted)
  - `reviewed_at` (timestamptz — when Meta completed review)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Security
- Enable RLS on `wa_blue_tick_applications`.
- Grant CRUD to `authenticated` only (this is a signed-in app).
- Owner-scoped CRUD: each authenticated user can only access their own applications.
- Grant `service_role` full CRUD for the edge function that proxies Meta's API.

## Notes
1. Each user can have multiple applications (e.g. for different WhatsApp numbers).
2. The `status` column is the CRM-side status; `meta_verification_status` is the raw status from Meta.
3. `documents_provided` is an array of document type names — actual document uploads go through Meta's Business Manager.
*/

CREATE TABLE IF NOT EXISTS wa_blue_tick_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  business_display_name text NOT NULL,
  business_category text NOT NULL,
  business_description text NOT NULL,
  website_url text,
  business_email text NOT NULL,
  business_phone text NOT NULL,
  address_line1 text NOT NULL,
  address_city text NOT NULL,
  address_state text,
  address_country text NOT NULL,
  address_postal_code text,
  waba_id text,
  phone_number_id text,
  documents_provided text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  meta_application_id text,
  meta_verification_status text,
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wa_blue_tick_applications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON wa_blue_tick_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_blue_tick_applications TO service_role;

DROP POLICY IF EXISTS "select_own_blue_tick_apps" ON wa_blue_tick_applications;
CREATE POLICY "select_own_blue_tick_apps"
  ON wa_blue_tick_applications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_blue_tick_apps" ON wa_blue_tick_applications;
CREATE POLICY "insert_own_blue_tick_apps"
  ON wa_blue_tick_applications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_blue_tick_apps" ON wa_blue_tick_applications;
CREATE POLICY "update_own_blue_tick_apps"
  ON wa_blue_tick_applications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_blue_tick_apps" ON wa_blue_tick_applications;
CREATE POLICY "delete_own_blue_tick_apps"
  ON wa_blue_tick_applications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_blue_tick_user_id ON wa_blue_tick_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_blue_tick_status ON wa_blue_tick_applications(status);
