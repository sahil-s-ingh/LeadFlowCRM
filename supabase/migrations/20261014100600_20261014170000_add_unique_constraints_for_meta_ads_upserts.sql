/*
# Add unique constraints for Meta Ads upserts

1. Changes
- Add unique constraint on (user_id, audience_id) for meta_custom_audiences — needed for list_custom_audiences upsert
- Add unique constraint on (user_id, form_id) for meta_lead_forms — needed for list_lead_forms upsert
- Add unique constraint on (user_id, leadgen_id) for meta_lead_form_leads — needed for get_lead_form_leads upsert

2. Notes
- These constraints are required for the onConflict upsert calls in the edge function to work correctly
- Uses IF NOT EXISTS to be idempotent
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_meta_custom_audiences_user_audience'
  ) THEN
    ALTER TABLE meta_custom_audiences ADD CONSTRAINT uq_meta_custom_audiences_user_audience UNIQUE (user_id, audience_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_meta_lead_forms_user_form'
  ) THEN
    ALTER TABLE meta_lead_forms ADD CONSTRAINT uq_meta_lead_forms_user_form UNIQUE (user_id, form_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_meta_lead_form_leads_user_leadgen'
  ) THEN
    ALTER TABLE meta_lead_form_leads ADD CONSTRAINT uq_meta_lead_form_leads_user_leadgen UNIQUE (user_id, leadgen_id);
  END IF;
END $$;
