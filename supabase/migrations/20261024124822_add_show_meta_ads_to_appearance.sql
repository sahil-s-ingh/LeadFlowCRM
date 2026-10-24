DO $$
BEGIN
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_meta_ads boolean DEFAULT true;
END $$;