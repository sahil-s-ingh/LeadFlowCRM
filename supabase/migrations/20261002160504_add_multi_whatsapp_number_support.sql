/*
# Multi-WhatsApp Number Support

## Purpose
Allows a single user to connect multiple WhatsApp Business API numbers. All conversations from all numbers appear in one unified inbox, with each conversation tagged with which number it belongs to. Users can filter by number.

## Changes

### 1. whatsapp_settings table
- Drop the UNIQUE(user_id) constraint so a user can have multiple rows (one per WhatsApp number).
- Add `label` column (text) — a human-readable name for this number (e.g. "Sales Line", "Support - US").
- Add `is_active` column (boolean, default true) — lets users deactivate a number without deleting it.

### 2. wa_conversations table
- Add `wa_settings_id` column (uuid, nullable, FK to whatsapp_settings.id) — links each conversation to the specific WhatsApp number that received it. Nullable so existing conversations aren't broken.
- Drop the old UNIQUE(user_id, wa_phone_number) constraint and replace with UNIQUE(wa_settings_id, wa_phone_number) so the same contact can message different numbers without collision.
- Add index on wa_settings_id for faster filtering.

### 3. Security
- whatsapp_settings RLS policies already exist (owner-scoped via user_id). No policy changes needed — the existing policies work with multiple rows per user.
- wa_conversations RLS policies already exist (owner-scoped via user_id subquery). No policy changes needed.

## Notes
- Existing conversations will have wa_settings_id = NULL. The webhook will be updated to set this for new conversations.
- The frontend will be updated to show all conversations in one inbox with a number filter dropdown.
- The UNIQUE constraint drop is safe — existing data has unique (user_id, wa_phone_number) pairs, and the new constraint (wa_settings_id, wa_phone_number) is a different scope.
*/

-- Step 1: Remove UNIQUE(user_id) constraint from whatsapp_settings
-- The constraint name from the original migration is whatsapp_settings_user_id_key
ALTER TABLE whatsapp_settings DROP CONSTRAINT IF EXISTS whatsapp_settings_user_id_key;

-- Step 2: Add label and is_active columns to whatsapp_settings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_settings' AND column_name = 'label') THEN
    ALTER TABLE whatsapp_settings ADD COLUMN label text DEFAULT 'WhatsApp Number';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_settings' AND column_name = 'is_active') THEN
    ALTER TABLE whatsapp_settings ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Step 3: Add wa_settings_id to wa_conversations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wa_conversations' AND column_name = 'wa_settings_id') THEN
    ALTER TABLE wa_conversations ADD COLUMN wa_settings_id uuid REFERENCES whatsapp_settings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 4: Backfill wa_settings_id for existing conversations
-- Link existing conversations to their owner's first (primary) whatsapp_settings row
UPDATE wa_conversations c
SET wa_settings_id = (
  SELECT ws.id FROM whatsapp_settings ws
  WHERE ws.user_id = c.user_id
  ORDER BY ws.created_at ASC
  LIMIT 1
)
WHERE c.wa_settings_id IS NULL
AND EXISTS (SELECT 1 FROM whatsapp_settings ws WHERE ws.user_id = c.user_id);

-- Step 5: Drop old unique constraint and add new one
ALTER TABLE wa_conversations DROP CONSTRAINT IF EXISTS wa_conversations_user_id_wa_phone_number_key;

-- Only add the new unique constraint if all existing rows have wa_settings_id populated
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM wa_conversations WHERE wa_settings_id IS NULL) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wa_conversations_settings_phone_key') THEN
      ALTER TABLE wa_conversations ADD CONSTRAINT wa_conversations_settings_phone_key UNIQUE (wa_settings_id, wa_phone_number);
    END IF;
  END IF;
END $$;

-- Step 6: Add index for filtering conversations by settings
CREATE INDEX IF NOT EXISTS idx_wa_conversations_settings_id ON wa_conversations(wa_settings_id);

-- Step 7: Enable realtime for wa_conversations if not already enabled (it was enabled in a prior migration)
-- No action needed — realtime was enabled in 20260925070108_enable_realtime_for_chat_tables.sql
