/*
# Add Telegram VIP member join tracking

1. Modified Tables
- `telegram_invite_links`: add `join_status` (text, default 'pending') — tracks whether the lead joined the channel: 'pending', 'joined', 'expired', 'revoked'.
- `telegram_invite_links`: add `joined_at` (timestamptz, nullable) — timestamp when the member actually joined the Telegram channel.
- `telegram_invite_links`: add `joined_by_telegram_user_id` (text, nullable) — the Telegram user ID of the person who joined via this link (for audit/matching).
- `telegram_invite_links`: add `tg_invite_link` (text, nullable) — the invite link string returned by Telegram API (the raw link object, for API polling comparison).

2. Security
- No new tables. No RLS changes — existing policies on `telegram_invite_links` already cover the owner's CRUD.
- No new grants needed — the table's existing grants apply to the new columns automatically.
*/

ALTER TABLE telegram_invite_links
  ADD COLUMN IF NOT EXISTS join_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS joined_by_telegram_user_id text,
  ADD COLUMN IF NOT EXISTS tg_invite_link text;

-- Backfill: set join_status = 'expired' for links past their expiry with status 'active'
UPDATE telegram_invite_links
  SET join_status = 'expired'
  WHERE join_status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < now();
