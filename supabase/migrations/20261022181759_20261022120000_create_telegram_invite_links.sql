/*
# Telegram VIP Invite Links

## Purpose
When a lead is moved to the "converted" stage, the sales agent can generate
a one-time Telegram invite link to a private VIP channel/group directly from
the lead drawer. Each generation is logged so the agent can see how many links
have been created for a particular lead.

## New Tables

### `telegram_invite_links`
- `id` (uuid, primary key)
- `lead_id` (uuid, references submissions.id ON DELETE CASCADE) — the lead this invite was generated for
- `user_id` (uuid, NOT NULL, DEFAULT auth.uid()) — the agent who generated the link
- `invite_link` (text, NOT NULL) — the Telegram invite URL
- `chat_id` (text) — the Telegram chat/channel ID the link grants access to
- `expires_at` (timestamptz) — when the link expires (typically 24h)
- `member_limit` (int, default 1) — single-use link
- `status` (text, default 'active') — 'active' or 'expired'
- `generated_count` (int, default 0) — not stored per-row; the count is derived via aggregation
- `created_at` (timestamptz, default now())

## Security
- Enable RLS on `telegram_invite_links`.
- Grant CRUD to `authenticated` (app has sign-in).
- Owner-scoped: agents can only see/generate links for their own workspace.
- `user_id` defaults to `auth.uid()` so inserts work without explicitly passing it.
- `lead_id` references `submissions(id)` — any authenticated user who can read a submission can generate an invite for it.

## Notes
1. The "generation count" per lead is computed as `COUNT(*) FROM telegram_invite_links WHERE lead_id = ?`.
2. The edge function `telegram-invite-link` uses the service role key to insert rows, so the RLS policies below apply to direct client reads (listing links for a lead).
*/

CREATE TABLE IF NOT EXISTS telegram_invite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_link text NOT NULL,
  chat_id text,
  expires_at timestamptz,
  member_limit int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE telegram_invite_links ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON telegram_invite_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON telegram_invite_links TO service_role;

CREATE INDEX IF NOT EXISTS idx_telegram_invite_links_lead_id ON telegram_invite_links(lead_id);
CREATE INDEX IF NOT EXISTS idx_telegram_invite_links_user_id ON telegram_invite_links(user_id);

DROP POLICY IF EXISTS "select_own_telegram_invites" ON telegram_invite_links;
CREATE POLICY "select_own_telegram_invites"
ON telegram_invite_links FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_telegram_invites" ON telegram_invite_links;
CREATE POLICY "insert_own_telegram_invites"
ON telegram_invite_links FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_telegram_invites" ON telegram_invite_links;
CREATE POLICY "update_own_telegram_invites"
ON telegram_invite_links FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_telegram_invites" ON telegram_invite_links;
CREATE POLICY "delete_own_telegram_invites"
ON telegram_invite_links FOR DELETE
TO authenticated USING (auth.uid() = user_id);