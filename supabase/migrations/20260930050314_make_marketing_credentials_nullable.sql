ALTER TABLE meta_marketing_settings
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN ad_account_id DROP NOT NULL;