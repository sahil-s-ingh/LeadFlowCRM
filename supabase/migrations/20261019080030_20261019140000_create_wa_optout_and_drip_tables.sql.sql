/*
# WhatsApp Broadcast: Opt-out tracking + Drip Sequences + Audience Manager

## What this does

Adds three new capabilities:

1. **Unsubscribe / Opt-out tracking** — when a lead replies "STOP", "UNSUBSCRIBE", etc. to a broadcast, they are flagged as opted-out and automatically excluded from future broadcasts. The existing `wa_opt_outs` table (created outside migrations) is enhanced with status, lead_id, timestamps for opt-in/out tracking.

2. **Broadcast Drip Sequence** — multi-step template series sent over multiple days. A cron processes due steps daily.

3. **Contact List / Audience Manager** — enhances `wa_broadcast_segments` with description, recipient_count cache, and a type field distinguishing reusable audiences from ad-hoc segments.

## Tables

### wa_opt_outs (modified — already exists)
- lead_id (uuid, nullable) — added
- opted_out_at (timestamptz) — added, defaults now
- opted_in_at (timestamptz, nullable) — added
- status (text, default 'opted_out') — added; 'opted_out' | 'subscribed'
- updated_at (timestamptz) — added
- Unique constraint on (user_id, phone_number)

### wa_drip_sequences (new)
- id, user_id, name, recipient_filter, segment_id, phone_number_id, status, total_recipients, started_at, completed_at, created_at, updated_at

### wa_drip_steps (new)
- id, sequence_id (FK cascade), user_id, step_number, template_name, template_language, template_components, variable_mapping, offset_days, status, sent_count, failed_count, sent_at, created_at

### wa_drip_recipients (new)
- id, sequence_id (FK cascade), step_id (FK cascade), user_id, lead_id, phone_number, recipient_name, status, variable_values, wa_message_id, error_message, sent_at, created_at

### wa_broadcast_segments (modified)
- description (text, nullable) — added
- recipient_count (int, default 0) — added
- type (text, default 'segment') — added

## Security
- RLS enabled on all new tables with owner-scoped CRUD
- Existing wa_opt_outs policies (if any) preserved; new policies added with DROP IF EXISTS first

## Notes
1. All new columns nullable or have safe defaults — no data loss
2. Opt-out check enforced in broadcast edge function create/send
3. Cron for drip steps registered separately
*/

-- ===================== ENHANCE EXISTING wa_opt_outs =====================
ALTER TABLE wa_opt_outs ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES submissions(id) ON DELETE SET NULL;
ALTER TABLE wa_opt_outs ADD COLUMN IF NOT EXISTS opted_out_at timestamptz DEFAULT now();
ALTER TABLE wa_opt_outs ADD COLUMN IF NOT EXISTS opted_in_at timestamptz;
ALTER TABLE wa_opt_outs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'opted_out';
ALTER TABLE wa_opt_outs ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill opted_out_at from created_at for existing rows
UPDATE wa_opt_outs SET opted_out_at = created_at WHERE opted_out_at IS NULL;

-- Ensure unique constraint (drop if exists first to avoid conflict)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wa_opt_outs_user_id_phone_number_key') THEN
    ALTER TABLE wa_opt_outs ADD CONSTRAINT wa_opt_outs_user_id_phone_number_key UNIQUE (user_id, phone_number);
  END IF;
END $$;

-- (Re)enable RLS and policies
ALTER TABLE wa_opt_outs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_optouts" ON wa_opt_outs;
CREATE POLICY "select_own_optouts" ON wa_opt_outs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_optouts" ON wa_opt_outs;
CREATE POLICY "insert_own_optouts" ON wa_opt_outs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_optouts" ON wa_opt_outs;
CREATE POLICY "update_own_optouts" ON wa_opt_outs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_optouts" ON wa_opt_outs;
CREATE POLICY "delete_own_optouts" ON wa_opt_outs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_opt_outs_user_phone ON wa_opt_outs(user_id, phone_number);

-- ===================== DRIP SEQUENCES =====================
CREATE TABLE IF NOT EXISTS wa_drip_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  recipient_filter text DEFAULT 'all',
  segment_id uuid REFERENCES wa_broadcast_segments(id) ON DELETE SET NULL,
  phone_number_id text,
  status text NOT NULL DEFAULT 'draft',
  total_recipients int NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wa_drip_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_drip_seq" ON wa_drip_sequences;
CREATE POLICY "select_own_drip_seq" ON wa_drip_sequences FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_drip_seq" ON wa_drip_sequences;
CREATE POLICY "insert_own_drip_seq" ON wa_drip_sequences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_drip_seq" ON wa_drip_sequences;
CREATE POLICY "update_own_drip_seq" ON wa_drip_sequences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_drip_seq" ON wa_drip_sequences;
CREATE POLICY "delete_own_drip_seq" ON wa_drip_sequences FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_drip_seq_user ON wa_drip_sequences(user_id);

-- ===================== DRIP STEPS =====================
CREATE TABLE IF NOT EXISTS wa_drip_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES wa_drip_sequences(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number int NOT NULL DEFAULT 1,
  template_name text NOT NULL,
  template_language text DEFAULT 'en_US',
  template_components jsonb DEFAULT '[]',
  variable_mapping jsonb DEFAULT '{}',
  offset_days int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wa_drip_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_drip_steps" ON wa_drip_steps;
CREATE POLICY "select_own_drip_steps" ON wa_drip_steps FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_drip_steps" ON wa_drip_steps;
CREATE POLICY "insert_own_drip_steps" ON wa_drip_steps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_drip_steps" ON wa_drip_steps;
CREATE POLICY "update_own_drip_steps" ON wa_drip_steps FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_drip_steps" ON wa_drip_steps;
CREATE POLICY "delete_own_drip_steps" ON wa_drip_steps FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_drip_steps_seq ON wa_drip_steps(sequence_id);

-- ===================== DRIP RECIPIENTS =====================
CREATE TABLE IF NOT EXISTS wa_drip_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES wa_drip_sequences(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES wa_drip_steps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  recipient_name text,
  status text NOT NULL DEFAULT 'pending',
  variable_values jsonb DEFAULT '{}',
  wa_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wa_drip_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_drip_recip" ON wa_drip_recipients;
CREATE POLICY "select_own_drip_recip" ON wa_drip_recipients FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_drip_recip" ON wa_drip_recipients;
CREATE POLICY "insert_own_drip_recip" ON wa_drip_recipients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_drip_recip" ON wa_drip_recipients;
CREATE POLICY "update_own_drip_recip" ON wa_drip_recipients FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_drip_recip" ON wa_drip_recipients;
CREATE POLICY "delete_own_drip_recip" ON wa_drip_recipients FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_drip_recip_step ON wa_drip_recipients(step_id);
CREATE INDEX IF NOT EXISTS idx_wa_drip_recip_seq ON wa_drip_recipients(sequence_id);

-- ===================== ENHANCE wa_broadcast_segments =====================
ALTER TABLE wa_broadcast_segments ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE wa_broadcast_segments ADD COLUMN IF NOT EXISTS recipient_count int NOT NULL DEFAULT 0;
ALTER TABLE wa_broadcast_segments ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'segment';
