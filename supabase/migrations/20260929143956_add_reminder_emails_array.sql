-- Add reminder_emails array column to support multiple reminder email addresses
ALTER TABLE follow_up_settings ADD COLUMN IF NOT EXISTS reminder_emails text[];

-- Migrate existing single reminder_email to the new array column
UPDATE follow_up_settings
SET reminder_emails = ARRAY[reminder_email]
WHERE reminder_email IS NOT NULL
  AND reminder_email != ''
  AND (reminder_emails IS NULL OR array_length(reminder_emails, 1) IS NULL);
