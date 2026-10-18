/*
# WhatsApp Drip Sequences + Contact Opt-Out / Consent Management

This migration adds two features on top of the existing WhatsApp chat tables:

1. WhatsApp Drip Sequences
   Admins define multi-step WhatsApp follow-up sequences. Each sequence has
   ordered steps with a delay (in hours) before the step fires. A lead or
   conversation can be enrolled in a sequence; a cron-driven edge function
   sends each step at the right time and marks enrollment progress.

2. Contact Opt-Out / Consent Management
   A blacklist of WhatsApp phone numbers that have opted out (either by
   texting STOP/UNSUBSCRIBE or by manual admin action). The broadcast and
   webhook layers consult this list to suppress outbound messages. The
   webhook auto-detects opt-out keywords and inserts a row here.

## New Tables

### wa_drip_sequences
- id uuid PK
- user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
- name text NOT NULL — human label
- description text
- trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual','on_new_conversation','on_lead_status'))
- trigger_config jsonb — e.g. {"lead_status":"new"} for lead_status trigger
- is_active boolean NOT NULL DEFAULT true
- total_steps int NOT NULL DEFAULT 0
- enrolled_count int NOT NULL DEFAULT 0
- created_at timestamptz DEFAULT now()
- updated_at timestamptz DEFAULT now()

### wa_drip_steps
- id uuid PK
- sequence_id uuid NOT NULL REFERENCES wa_drip_sequences(id) ON DELETE CASCADE
- user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
- step_order int NOT NULL — 1-based ordering
- delay_hours int NOT NULL DEFAULT 24 — hours after enrollment (step 1) or after previous step
- message_text text NOT NULL — the WhatsApp text to send
- template_name text — optional approved template name for template messages
- created_at timestamptz DEFAULT now()
- UNIQUE(sequence_id, step_order)

### wa_drip_enrollments
- id uuid PK
- sequence_id uuid NOT NULL REFERENCES wa_drip_sequences(id) ON DELETE CASCADE
- user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
- conversation_id uuid REFERENCES wa_conversations(id) ON DELETE CASCADE
- phone_number text NOT NULL — E.164
- current_step int NOT NULL DEFAULT 0 — last completed step
- next_step_at timestamptz — when the next step should fire
- status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','opted_out'))
- enrolled_at timestamptz DEFAULT now()
- completed_at timestamptz
- UNIQUE(sequence_id, phone_number)

### wa_opt_outs
- id uuid PK
- user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
- phone_number text NOT NULL — E.164
- reason text — 'keyword' (auto via STOP) or 'manual'
- source text — the inbound keyword that triggered it, or 'admin'
- created_at timestamptz DEFAULT now()
- UNIQUE(user_id, phone_number)

## Indexes
- idx_wa_drip_sequences_user ON wa_drip_sequences(user_id)
- idx_wa_drip_steps_seq ON wa_drip_steps(sequence_id, step_order)
- idx_wa_drip_enrollments_active ON wa_drip_enrollments(user_id, status, next_step_at)
- idx_wa_opt_outs_user_phone ON wa_opt_outs(user_id, phone_number)

## Security
- RLS enabled on all four tables.
- Owner-scoped CRUD on every table (auth.uid() = user_id).
- The webhook inserts opt-out rows and drip enrollments using the service
  role key (bypasses RLS); the INSERT policies are also present for
  client-side convenience.
*/

CREATE TABLE IF NOT EXISTS wa_drip_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual','on_new_conversation','on_lead_status')),
  trigger_config jsonb,
  is_active boolean NOT NULL DEFAULT true,
  total_steps int NOT NULL DEFAULT 0,
  enrolled_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wa_drip_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES wa_drip_sequences(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  delay_hours int NOT NULL DEFAULT 24,
  message_text text NOT NULL,
  template_name text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sequence_id, step_order)
);

CREATE TABLE IF NOT EXISTS wa_drip_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES wa_drip_sequences(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES wa_conversations(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  current_step int NOT NULL DEFAULT 0,
  next_step_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','opted_out')),
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(sequence_id, phone_number)
);

CREATE TABLE IF NOT EXISTS wa_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  reason text,
  source text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_wa_drip_sequences_user ON wa_drip_sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_drip_steps_seq ON wa_drip_steps(sequence_id, step_order);
CREATE INDEX IF NOT EXISTS idx_wa_drip_enrollments_active ON wa_drip_enrollments(user_id, status, next_step_at);
CREATE INDEX IF NOT EXISTS idx_wa_opt_outs_user_phone ON wa_opt_outs(user_id, phone_number);

ALTER TABLE wa_drip_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_drip_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_drip_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_opt_outs ENABLE ROW LEVEL SECURITY;

-- wa_drip_sequences: owner-scoped CRUD
DROP POLICY IF EXISTS "select_own_wa_drip_sequences" ON wa_drip_sequences;
CREATE POLICY "select_own_wa_drip_sequences" ON wa_drip_sequences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_wa_drip_sequences" ON wa_drip_sequences;
CREATE POLICY "insert_own_wa_drip_sequences" ON wa_drip_sequences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_wa_drip_sequences" ON wa_drip_sequences;
CREATE POLICY "update_own_wa_drip_sequences" ON wa_drip_sequences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_wa_drip_sequences" ON wa_drip_sequences;
CREATE POLICY "delete_own_wa_drip_sequences" ON wa_drip_sequences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- wa_drip_steps: owner-scoped CRUD
DROP POLICY IF EXISTS "select_own_wa_drip_steps" ON wa_drip_steps;
CREATE POLICY "select_own_wa_drip_steps" ON wa_drip_steps FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_wa_drip_steps" ON wa_drip_steps;
CREATE POLICY "insert_own_wa_drip_steps" ON wa_drip_steps FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_wa_drip_steps" ON wa_drip_steps;
CREATE POLICY "update_own_wa_drip_steps" ON wa_drip_steps FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_wa_drip_steps" ON wa_drip_steps;
CREATE POLICY "delete_own_wa_drip_steps" ON wa_drip_steps FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- wa_drip_enrollments: owner-scoped CRUD
DROP POLICY IF EXISTS "select_own_wa_drip_enrollments" ON wa_drip_enrollments;
CREATE POLICY "select_own_wa_drip_enrollments" ON wa_drip_enrollments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_wa_drip_enrollments" ON wa_drip_enrollments;
CREATE POLICY "insert_own_wa_drip_enrollments" ON wa_drip_enrollments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_wa_drip_enrollments" ON wa_drip_enrollments;
CREATE POLICY "update_own_wa_drip_enrollments" ON wa_drip_enrollments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_wa_drip_enrollments" ON wa_drip_enrollments;
CREATE POLICY "delete_own_wa_drip_enrollments" ON wa_drip_enrollments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- wa_opt_outs: owner-scoped CRUD
DROP POLICY IF EXISTS "select_own_wa_opt_outs" ON wa_opt_outs;
CREATE POLICY "select_own_wa_opt_outs" ON wa_opt_outs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_wa_opt_outs" ON wa_opt_outs;
CREATE POLICY "insert_own_wa_opt_outs" ON wa_opt_outs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_wa_opt_outs" ON wa_opt_outs;
CREATE POLICY "update_own_wa_opt_outs" ON wa_opt_outs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_wa_opt_outs" ON wa_opt_outs;
CREATE POLICY "delete_own_wa_opt_outs" ON wa_opt_outs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
