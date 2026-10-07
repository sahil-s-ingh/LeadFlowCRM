/*
# Create IB Leads table

## Purpose
A dedicated table for managing IB (Introducing Broker) client applications,
separate from the regular `submissions` (leads) table. This allows the CRM
admin to track IB applicants through their own pipeline with IB-specific fields.

## New Table: ib_leads
- id (uuid, PK, default gen_random_uuid())
- full_name (text, not null) — applicant's full name
- mobile_number (text, not null) — phone number
- email (text, not null) — email address
- state (text, not null) — Indian state
- broker_name (text, nullable) — the broker the applicant is applying to (e.g. Exness, IC Markets)
- ib_type (text, not null, default 'standard') — type of IB partnership: 'standard' | 'premium' | 'white_label'
- commission_level (text, nullable) — commission tier agreed with the applicant
- status (text, not null, default 'new') — pipeline status: 'new' | 'contacted' | 'docs_requested' | 'docs_received' | 'approved' | 'rejected'
- tags (text[], default '{}') — flexible tags for categorization
- notes (text, default '') — freeform notes
- fund_amount (numeric, nullable) — expected fund/volume amount
- assigned_to (uuid, nullable) — team member assigned to this IB lead
- last_contacted_at (timestamptz, nullable) — last contact timestamp
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
- deleted_at (timestamptz, nullable) — soft delete timestamp
- deleted_by (uuid, nullable) — user who soft-deleted
- lead_score (integer, default 0) — computed lead score

## Security
- RLS enabled on ib_leads
- SELECT/UPDATE/DELETE scoped to authenticated users (same pattern as submissions)
- INSERT allowed for anon + authenticated (so public forms can submit IB applications)

## Indexes
- idx_ib_leads_created_at on created_at DESC
- idx_ib_leads_status on status
- idx_ib_leads_email on email
- idx_ib_leads_mobile on mobile_number
*/

CREATE TABLE IF NOT EXISTS ib_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  mobile_number text NOT NULL,
  email text NOT NULL,
  state text NOT NULL,
  broker_name text,
  ib_type text NOT NULL DEFAULT 'standard' CHECK (ib_type IN ('standard', 'premium', 'white_label')),
  commission_level text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'docs_requested', 'docs_received', 'approved', 'rejected')),
  tags text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  fund_amount numeric,
  assigned_to uuid,
  last_contacted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  lead_score integer NOT NULL DEFAULT 0
);

ALTER TABLE ib_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_ib_leads" ON ib_leads;
CREATE POLICY "authenticated_select_ib_leads"
ON ib_leads FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "anon_insert_ib_leads" ON ib_leads;
CREATE POLICY "anon_insert_ib_leads"
ON ib_leads FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_ib_leads" ON ib_leads;
CREATE POLICY "authenticated_update_ib_leads"
ON ib_leads FOR UPDATE
TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_ib_leads" ON ib_leads;
CREATE POLICY "authenticated_delete_ib_leads"
ON ib_leads FOR DELETE
TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_ib_leads_created_at ON ib_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ib_leads_status ON ib_leads (status);
CREATE INDEX IF NOT EXISTS idx_ib_leads_email ON ib_leads (email);
CREATE INDEX IF NOT EXISTS idx_ib_leads_mobile ON ib_leads (mobile_number);