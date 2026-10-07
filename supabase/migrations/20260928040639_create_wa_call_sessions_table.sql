/*
# Create WhatsApp Call Sessions Table

1. New Tables
- `wa_call_sessions`
  - `id` (uuid, primary key) — unique call session identifier
  - `user_id` (uuid, not null) — the CRM user who initiated the call
  - `phone_number` (text, not null) — the lead's phone number being called (E.164 format)
  - `call_id` (text, nullable) — WhatsApp call ID returned by Meta (wacid.xxx)
  - `status` (text, not null, default 'initiating') — call lifecycle: initiating, ringing, accepted, rejected, failed, ended
  - `sdp_offer` (text, nullable) — the WebRTC SDP offer sent to Meta
  - `sdp_answer` (text, nullable) — the SDP answer received from Meta via webhook
  - `direction` (text, default 'business_initiated') — call direction
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
2. Security
- Enable RLS on `wa_call_sessions`.
- Owner-scoped CRUD: each authenticated user can only access their own call sessions.
- The whatsapp-call-signaling webhook function uses the service role key (bypasses RLS) to update call status and SDP answer.
3. Indexes
- Index on `user_id` for fast lookups
- Index on `call_id` for webhook lookups
4. Notes
- The `sdp_answer` column is what the browser polls to get Meta's WebRTC answer after initiating a call.
- The `status` column tracks the call lifecycle for UI feedback.
*/

CREATE TABLE IF NOT EXISTS wa_call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  phone_number text NOT NULL,
  call_id text,
  status text NOT NULL DEFAULT 'initiating',
  sdp_offer text,
  sdp_answer text,
  direction text DEFAULT 'business_initiated',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wa_call_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_wa_call_sessions_user_id ON wa_call_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_call_sessions_call_id ON wa_call_sessions(call_id);

DROP POLICY IF EXISTS "select_own_wa_call_sessions" ON wa_call_sessions;
CREATE POLICY "select_own_wa_call_sessions"
ON wa_call_sessions FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_call_sessions" ON wa_call_sessions;
CREATE POLICY "insert_own_wa_call_sessions"
ON wa_call_sessions FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wa_call_sessions" ON wa_call_sessions;
CREATE POLICY "update_own_wa_call_sessions"
ON wa_call_sessions FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wa_call_sessions" ON wa_call_sessions;
CREATE POLICY "delete_own_wa_call_sessions"
ON wa_call_sessions FOR DELETE
TO authenticated USING (auth.uid() = user_id);
