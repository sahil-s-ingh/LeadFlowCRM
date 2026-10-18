-- Add 'template' to the message_type CHECK constraint on wa_messages
-- The send-whatsapp-message edge function inserts message_type='template' for
-- approved template messages, but the original CHECK constraint did not include it,
-- causing "Failed to save message" errors when sending templates.

ALTER TABLE wa_messages DROP CONSTRAINT IF EXISTS wa_messages_message_type_check;

ALTER TABLE wa_messages ADD CONSTRAINT wa_messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'video', 'audio', 'voice', 'document', 'sticker', 'location', 'contacts', 'template', 'reaction', 'interactive'));
