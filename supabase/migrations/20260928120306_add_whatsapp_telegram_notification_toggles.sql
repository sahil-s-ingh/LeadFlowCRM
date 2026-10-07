ALTER TABLE follow_up_settings
  ADD COLUMN IF NOT EXISTS enable_whatsapp_notifications boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_telegram_notifications boolean NOT NULL DEFAULT false;
