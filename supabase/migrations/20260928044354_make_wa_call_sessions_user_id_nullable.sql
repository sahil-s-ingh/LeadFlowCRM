-- Make user_id nullable on wa_call_sessions so the signaling webhook can insert incoming calls
-- even when the owner user_id lookup fails (service role bypasses RLS but NOT NULL still applies)
ALTER TABLE wa_call_sessions ALTER COLUMN user_id DROP NOT NULL;
