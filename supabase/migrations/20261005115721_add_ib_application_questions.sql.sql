/*
# Add IB application questionnaire answers

## Purpose
Store every answer from the IB application form as a separate, searchable field.
Existing IB lead records are preserved and continue to work.

## Modified Table: ib_leads
- country_of_residence (text, nullable) — applicant's country
- current_ib_affiliate (text, nullable) — current IB or affiliate experience
- network_size (text, nullable) — approximate current trader/client network size
- client_acquisition_method (text, nullable) — primary client acquisition channel
- business_type (text, nullable) — applicant's business category
- monthly_referral_capacity (text, nullable) — potential monthly trader referrals
- partnership_need (text, nullable) — primary broker partnership requirement

## Security
The existing RLS protection on `ib_leads` remains unchanged. These fields use
those same existing table policies and are available to authenticated CRM users
and to public IB application inserts.

## Data Safety
All new columns are nullable so existing IB lead records are not invalidated.
The application form requires an answer at the client-facing boundary.
*/

ALTER TABLE ib_leads ADD COLUMN IF NOT EXISTS country_of_residence text;
ALTER TABLE ib_leads ADD COLUMN IF NOT EXISTS current_ib_affiliate text;
ALTER TABLE ib_leads ADD COLUMN IF NOT EXISTS network_size text;
ALTER TABLE ib_leads ADD COLUMN IF NOT EXISTS client_acquisition_method text;
ALTER TABLE ib_leads ADD COLUMN IF NOT EXISTS business_type text;
ALTER TABLE ib_leads ADD COLUMN IF NOT EXISTS monthly_referral_capacity text;
ALTER TABLE ib_leads ADD COLUMN IF NOT EXISTS partnership_need text;

CREATE INDEX IF NOT EXISTS idx_ib_leads_country ON ib_leads (country_of_residence);
CREATE INDEX IF NOT EXISTS idx_ib_leads_business_type ON ib_leads (business_type);