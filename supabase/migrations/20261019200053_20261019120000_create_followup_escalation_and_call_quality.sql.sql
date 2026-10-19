/*
# Follow-up Escalation Settings + Call Quality Scoring

## What this migration does

### 1. followup_escalation_settings table
Per-user configuration for automatic follow-up escalation. When a follow-up
reminder is overdue beyond a configurable threshold, the system escalates in steps:
- Step 1: Send reminder to the assigned agent
- Step 2: Escalate to a manager
- Step 3: Optionally reassign the lead

### 2. followup_escalation_log table
Audit trail of every escalation action taken.

### 3. call_quality_settings table
Per-user configuration for call quality scoring.

### 4. call_quality_scores table
AI-generated quality scores for call recordings with sub-scores and feedback.

## Security
- All tables use RLS with owner-scoped policies (auth.uid() = user_id).
- Log/score tables: owner SELECT only (inserts by edge function via service role).
*/

-- ===================== Follow-up Escalation Settings =====================
CREATE TABLE IF NOT EXISTS followup_escalation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  step1_enabled boolean NOT NULL DEFAULT true,
  step1_hours integer NOT NULL DEFAULT 2,
  step2_enabled boolean NOT NULL DEFAULT true,
  step2_hours integer NOT NULL DEFAULT 6,
  step2_manager_email text,
  step3_enabled boolean NOT NULL DEFAULT false,
  step3_hours integer NOT NULL DEFAULT 24,
  step3_reassign_lead boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE followup_escalation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_escalation_settings" ON followup_escalation_settings;
CREATE POLICY "select_own_escalation_settings" ON followup_escalation_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_escalation_settings" ON followup_escalation_settings;
CREATE POLICY "insert_own_escalation_settings" ON followup_escalation_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_escalation_settings" ON followup_escalation_settings;
CREATE POLICY "update_own_escalation_settings" ON followup_escalation_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_escalation_settings" ON followup_escalation_settings;
CREATE POLICY "delete_own_escalation_settings" ON followup_escalation_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ===================== Follow-up Escalation Log =====================
CREATE TABLE IF NOT EXISTS followup_escalation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  followup_id uuid REFERENCES lead_followups(id) ON DELETE CASCADE,
  lead_id uuid,
  step integer NOT NULL,
  action text NOT NULL,
  notified_email text,
  reassigned_to uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE followup_escalation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_escalation_log" ON followup_escalation_log;
CREATE POLICY "select_own_escalation_log" ON followup_escalation_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ===================== Call Quality Settings =====================
CREATE TABLE IF NOT EXISTS call_quality_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  auto_score_new_calls boolean NOT NULL DEFAULT true,
  min_call_duration_sec integer NOT NULL DEFAULT 30,
  script_weight integer NOT NULL DEFAULT 30,
  objection_weight integer NOT NULL DEFAULT 25,
  tone_weight integer NOT NULL DEFAULT 25,
  pacing_weight integer NOT NULL DEFAULT 20,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE call_quality_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_call_quality_settings" ON call_quality_settings;
CREATE POLICY "select_own_call_quality_settings" ON call_quality_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_call_quality_settings" ON call_quality_settings;
CREATE POLICY "insert_own_call_quality_settings" ON call_quality_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_call_quality_settings" ON call_quality_settings;
CREATE POLICY "update_own_call_quality_settings" ON call_quality_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_call_quality_settings" ON call_quality_settings;
CREATE POLICY "delete_own_call_quality_settings" ON call_quality_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ===================== Call Quality Scores =====================
CREATE TABLE IF NOT EXISTS call_quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  call_session_id uuid,
  call_log_id uuid,
  lead_phone text,
  agent_email text,
  call_duration_sec integer,
  overall_score integer NOT NULL DEFAULT 0,
  script_adherence_score integer NOT NULL DEFAULT 0,
  objection_handling_score integer NOT NULL DEFAULT 0,
  tone_score integer NOT NULL DEFAULT 0,
  pacing_score integer NOT NULL DEFAULT 0,
  feedback_summary text,
  key_moments jsonb,
  red_flags jsonb,
  transcript_snippet text,
  scored_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE call_quality_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_call_quality_scores" ON call_quality_scores;
CREATE POLICY "select_own_call_quality_scores" ON call_quality_scores FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_followup_escalation_log_user ON followup_escalation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_call_quality_scores_user ON call_quality_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_call_quality_scores_scored ON call_quality_scores(scored_at DESC);
