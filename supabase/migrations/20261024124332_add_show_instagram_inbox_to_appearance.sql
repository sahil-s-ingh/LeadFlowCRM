DO $$
BEGIN
  ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS show_instagram_inbox boolean DEFAULT true;
END $$;