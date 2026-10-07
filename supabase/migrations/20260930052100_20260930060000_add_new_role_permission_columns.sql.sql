-- Add analytics, broadcasts, followUps, and automations permission columns to role_permissions
ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS analytics boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS broadcasts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_ups boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS automations boolean NOT NULL DEFAULT false;
