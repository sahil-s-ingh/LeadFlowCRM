/*
# Multi-Telegram-Bot Support

## What this does
Allows each admin to connect multiple Telegram bots (e.g. a sales bot, a support bot, a community bot).
Previously, only one bot per admin was supported via the `telegram_settings` table.

## Changes

### 1. New Table: `telegram_bots`
- Stores individual bot configurations (token, username, welcome message, label).
- Each bot belongs to an admin (user_id).
- Has a `webhook_secret` column used in the webhook URL for secure routing.
- `is_active` flag to enable/disable bots without deleting them.

### 2. Modified Tables
- `chat_conversations`: adds `bot_id` (nullable FK to telegram_bots) so conversations are attributed to a specific bot.
- `tg_broadcast_campaigns`: adds `bot_id` (nullable FK to telegram_bots) so broadcasts are sent via a specific bot.

### 3. Backfill
- For each existing `telegram_settings` row with a `bot_token`, creates a corresponding `telegram_bots` row.
- Updates all existing `chat_conversations` and `tg_broadcast_campaigns` rows to point to the backfilled bot.

### 4. Security
- RLS enabled on `telegram_bots` with owner-scoped CRUD.
- Existing RLS policies on `chat_conversations` and `tg_broadcast_campaigns` continue to work (they use user_id, not bot_id).
- The `webhook_secret` is a random UUID used in the webhook URL path so incoming messages route to the correct bot. It is NOT a security credential — it only identifies which bot received the update.
*/

-- 1. Create telegram_bots table
CREATE TABLE IF NOT EXISTS telegram_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Default Bot',
  bot_token text NOT NULL,
  bot_username text,
  welcome_message text DEFAULT 'Hi! Thanks for reaching out. Our team will get back to you shortly.',
  webhook_secret uuid NOT NULL DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE telegram_bots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tg_bots" ON telegram_bots;
CREATE POLICY "select_own_tg_bots" ON telegram_bots FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tg_bots" ON telegram_bots;
CREATE POLICY "insert_own_tg_bots" ON telegram_bots FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tg_bots" ON telegram_bots;
CREATE POLICY "update_own_tg_bots" ON telegram_bots FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tg_bots" ON telegram_bots;
CREATE POLICY "delete_own_tg_bots" ON telegram_bots FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_bots_user_id ON telegram_bots(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_bots_webhook_secret ON telegram_bots(webhook_secret);

-- 2. Add bot_id to chat_conversations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_conversations' AND column_name = 'bot_id') THEN
    ALTER TABLE chat_conversations ADD COLUMN bot_id uuid REFERENCES telegram_bots(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Add bot_id to tg_broadcast_campaigns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tg_broadcast_campaigns' AND column_name = 'bot_id') THEN
    ALTER TABLE tg_broadcast_campaigns ADD COLUMN bot_id uuid REFERENCES telegram_bots(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Backfill: create a telegram_bots row for each existing telegram_settings row with a bot_token
DO $$
DECLARE
  ts_record RECORD;
  bot_id uuid;
BEGIN
  FOR ts_record IN
    SELECT id, user_id, bot_token, bot_username, welcome_message
    FROM telegram_settings
    WHERE bot_token IS NOT NULL AND bot_token != ''
  LOOP
    -- Check if a bot with this token already exists for this user
    SELECT id INTO bot_id FROM telegram_bots
      WHERE user_id = ts_record.user_id AND bot_token = ts_record.bot_token
      LIMIT 1;

    IF bot_id IS NULL THEN
      INSERT INTO telegram_bots (user_id, label, bot_token, bot_username, welcome_message)
      VALUES (ts_record.user_id, 'Default Bot', ts_record.bot_token, ts_record.bot_username, ts_record.welcome_message)
      RETURNING id INTO bot_id;
    END IF;

    -- Update conversations for this user to point to the bot
    UPDATE chat_conversations SET bot_id = bot_id
      WHERE user_id = ts_record.user_id AND bot_id IS NULL;

    -- Update broadcast campaigns for this user to point to the bot
    UPDATE tg_broadcast_campaigns SET bot_id = bot_id
      WHERE user_id = ts_record.user_id AND bot_id IS NULL;
  END LOOP;
END $$;

-- 5. Add index on bot_id for conversations
CREATE INDEX IF NOT EXISTS idx_chat_conversations_bot_id ON chat_conversations(bot_id);
CREATE INDEX IF NOT EXISTS idx_tg_broadcast_campaigns_bot_id ON tg_broadcast_campaigns(bot_id);
