/*
# Call Guardrails — DND list, quiet hours, per-lead cooldown, consent tracking

## Summary
Adds server-enforced call guardrails for the WhatsApp and virtual (Twilio/Exotel/Plivo)
calling systems. Before any call is placed, the edge function checks:
  1. Is the number on the account's Do-Not-Call list? → block.
  2. Is the current time inside the account's quiet-hours window? → block.
  3. Was a call to this exact lead made within the cooldown window? → block.
  4. Did the account require recording consent? If so, the request must carry consent=true.

## New Tables

### call_guardrail_settings (one row per CRM account/user)
- id uuid PK
- user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
- enabled boolean DEFAULT false — master switch
- dnd_phone_numbers text[] DEFAULT '{}' — array of E.164 numbers that must never be called
- quiet_hours_enabled boolean DEFAULT false
- quiet_hours_start time DEFAULT '22:00' — start of quiet window (local clock)
- quiet_hours_end time DEFAULT '08:00' — end of quiet window (local clock)
- timezone text DEFAULT 'Asia/Kolkata' — IANA tz used to evaluate quiet hours
- cooldown_enabled boolean DEFAULT false
- cooldown_minutes integer DEFAULT 180 — minimum minutes between calls to the same lead
- require_recording_consent boolean DEFAULT false — when true, calls must carry consent=true
- created_at, updated_at timestamptz

### call_schedule (scheduled/reminder calls a user books with a lead)
- id uuid PK
- user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
- lead_id uuid REFERENCES submissions(id) ON DELETE SET NULL
- phone_number text NOT NULL
- scheduled_at timestamptz NOT NULL — when the call is due
- title text
- notes text
- status text NOT NULL DEFAULT 'pending' — pending, reminded, completed, cancelled
- reminder_sent_at timestamptz
- created_at timestamptz DEFAULT now()

## Security
- RLS enabled on both tables.
- call_guardrail_settings: owner-scoped CRUD (authenticated, auth.uid() = user_id).
  The calling edge functions read it with the service role key (bypasses RLS).
- call_schedule: owner-scoped CRUD (authenticated, auth.uid() = user_id).
- The process-followups / scheduled-emails cron can read call_schedule with the
  service role key to send reminders; no anon policy is needed.

## Notes
- All columns are additive; existing call tables are untouched.
- Idempotent: uses IF NOT EXISTS / DROP POLICY IF EXISTS.
*/

CREATE TABLE IF NOT EXISTS call_guardrail_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  dnd_phone_numbers text[] NOT NULL DEFAULT '{}',
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start time NOT NULL DEFAULT '22:00',
  quiet_hours_end time NOT NULL DEFAULT '08:00',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  cooldown_enabled boolean NOT NULL DEFAULT false,
  cooldown_minutes integer NOT NULL DEFAULT 180,
  require_recording_consent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE call_guardrail_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_call_guardrails" ON call_guardrail_settings;
CREATE POLICY "select_own_call_guardrails" ON call_guardrail_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_call_guardrails" ON call_guardrail_settings;
CREATE POLICY "insert_own_call_guardrails" ON call_guardrail_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_call_guardrails" ON call_guardrail_settings;
CREATE POLICY "update_own_call_guardrails" ON call_guardrail_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_call_guardrails" ON call_guardrail_settings;
CREATE POLICY "delete_own_call_guardrails" ON call_guardrail_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS call_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  title text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE call_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_call_schedule" ON call_schedule;
CREATE POLICY "select_own_call_schedule" ON call_schedule
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_call_schedule" ON call_schedule;
CREATE POLICY "insert_own_call_schedule" ON call_schedule
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_call_schedule" ON call_schedule;
CREATE POLICY "update_own_call_schedule" ON call_schedule
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_call_schedule" ON call_schedule;
CREATE POLICY "delete_own_call_schedule" ON call_schedule
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_call_schedule_user_status ON call_schedule(user_id, status);
CREATE INDEX IF NOT EXISTS idx_call_schedule_due ON call_schedule(scheduled_at) WHERE status = 'pending';

-- Helper: normalize a phone number to digits-without-plus for comparison
CREATE OR REPLACE FUNCTION normalize_phone_for_compare(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(COALESCE(p, ''), '[^0-9]', '', 'g')
$$;