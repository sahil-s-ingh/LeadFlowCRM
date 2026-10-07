/*
# Create reply_templates, lead_activities, and drip_campaigns tables

## Overview
Adds three new features to the CRM:
1. **Saved Reply Templates** — reusable message snippets for quick insertion into Telegram/WhatsApp chats.
2. **Lead Activity Timeline** — a unified log of every interaction with a lead (emails, chats, status changes, follow-ups, notes).
3. **Automated Drip Campaigns** — sequences of scheduled messages sent automatically to leads over time.

## New Tables

### 1. reply_templates
Stores reusable message snippets organized by channel.
- `id` (uuid, primary key)
- `user_id` (uuid, owner, defaults to auth.uid())
- `title` (text, short label shown in the template picker)
- `body` (text, the full message text to insert)
- `channel` (text: 'telegram' | 'whatsapp' | 'email' | 'all' — which chat channels this template applies to)
- `category` (text, optional grouping label)
- `sort_order` (int, default 0, for custom ordering)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 2. lead_activities
A unified chronological log of every interaction with a lead.
- `id` (uuid, primary key)
- `user_id` (uuid, owner, defaults to auth.uid())
- `lead_id` (uuid, references submissions(id) on delete cascade)
- `activity_type` (text: 'status_change' | 'note' | 'email_sent' | 'telegram_message' | 'whatsapp_message' | 'follow_up_created' | 'follow_up_done' | 'lead_created' | 'tag_added' | 'tag_removed' | 'call' | 'assignment')
- `description` (text, human-readable summary)
- `metadata` (jsonb, optional structured details like old/new status, message snippet, etc.)
- `created_at` (timestamptz)

### 3. drip_campaigns
Top-level campaign definitions.
- `id` (uuid, primary key)
- `user_id` (uuid, owner, defaults to auth.uid())
- `name` (text, campaign name)
- `description` (text, optional)
- `channel` (text: 'email' | 'telegram' | 'whatsapp' — which channel to send through)
- `trigger_status` (text, nullable — which lead status triggers enrollment, e.g. 'new')
- `is_active` (boolean, default true)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 4. drip_steps
Individual steps within a drip campaign, each sent after a delay.
- `id` (uuid, primary key)
- `campaign_id` (uuid, references drip_campaigns(id) on delete cascade)
- `user_id` (uuid, owner, defaults to auth.uid())
- `step_number` (int, order of the step, 1-based)
- `delay_hours` (int, hours after enrollment to send this step)
- `subject` (text, optional — email subject line)
- `body` (text, message content; supports {{full_name}}, {{email}}, {{mobile_number}} placeholders)
- `created_at` (timestamptz)

### 5. drip_enrollments
Tracks which leads are enrolled in which campaigns and progress.
- `id` (uuid, primary key)
- `user_id` (uuid, owner, defaults to auth.uid())
- `campaign_id` (uuid, references drip_campaigns(id) on delete cascade)
- `lead_id` (uuid, references submissions(id) on delete cascade)
- `enrolled_at` (timestamptz, when the lead was enrolled)
- `current_step` (int, default 0 — next step to send)
- `status` (text: 'active' | 'completed' | 'paused' | 'unsubscribed', default 'active')
- `created_at` (timestamptz)

## Security
- RLS enabled on all 5 tables.
- Owner-scoped CRUD policies (auth.uid() = user_id) for all tables.
- For drip_steps: ownership checked through parent campaign via EXISTS subquery.
- For drip_enrollments: ownership checked through parent campaign via EXISTS subquery.
- For lead_activities: ownership checked through user_id directly.

## Important Notes
1. All tables use `DEFAULT auth.uid()` on user_id so client inserts that omit user_id still pass RLS.
2. drip_steps and drip_enrollments use EXISTS subquery to verify ownership through drip_campaigns.
3. lead_activities.lead_id references submissions(id) with ON DELETE CASCADE so activities are cleaned up when a lead is deleted.
4. drip_enrollments.lead_id also cascades on lead deletion.
5. Indexes added on lead_id, campaign_id, and user_id for query performance.
*/

-- 1. reply_templates
CREATE TABLE IF NOT EXISTS reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'all' CHECK (channel IN ('telegram', 'whatsapp', 'email', 'all')),
  category text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reply_templates" ON reply_templates;
CREATE POLICY "select_own_reply_templates" ON reply_templates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reply_templates" ON reply_templates;
CREATE POLICY "insert_own_reply_templates" ON reply_templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reply_templates" ON reply_templates;
CREATE POLICY "update_own_reply_templates" ON reply_templates FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reply_templates" ON reply_templates;
CREATE POLICY "delete_own_reply_templates" ON reply_templates FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reply_templates_user_id ON reply_templates(user_id);

-- 2. lead_activities
CREATE TABLE IF NOT EXISTS lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES submissions(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lead_activities" ON lead_activities;
CREATE POLICY "select_own_lead_activities" ON lead_activities FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_lead_activities" ON lead_activities;
CREATE POLICY "insert_own_lead_activities" ON lead_activities FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_lead_activities" ON lead_activities;
CREATE POLICY "update_own_lead_activities" ON lead_activities FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_lead_activities" ON lead_activities;
CREATE POLICY "delete_own_lead_activities" ON lead_activities FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_user_id ON lead_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON lead_activities(created_at DESC);

-- 3. drip_campaigns
CREATE TABLE IF NOT EXISTS drip_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'telegram', 'whatsapp')),
  trigger_status text DEFAULT 'new',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE drip_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_drip_campaigns" ON drip_campaigns;
CREATE POLICY "select_own_drip_campaigns" ON drip_campaigns FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_drip_campaigns" ON drip_campaigns;
CREATE POLICY "insert_own_drip_campaigns" ON drip_campaigns FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_drip_campaigns" ON drip_campaigns;
CREATE POLICY "update_own_drip_campaigns" ON drip_campaigns FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_drip_campaigns" ON drip_campaigns;
CREATE POLICY "delete_own_drip_campaigns" ON drip_campaigns FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_drip_campaigns_user_id ON drip_campaigns(user_id);

-- 4. drip_steps
CREATE TABLE IF NOT EXISTS drip_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number int NOT NULL DEFAULT 1,
  delay_hours int NOT NULL DEFAULT 24,
  subject text DEFAULT '',
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE drip_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_drip_steps" ON drip_steps;
CREATE POLICY "select_own_drip_steps" ON drip_steps FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM drip_campaigns WHERE drip_campaigns.id = drip_steps.campaign_id AND drip_campaigns.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_drip_steps" ON drip_steps;
CREATE POLICY "insert_own_drip_steps" ON drip_steps FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM drip_campaigns WHERE drip_campaigns.id = drip_steps.campaign_id AND drip_campaigns.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_drip_steps" ON drip_steps;
CREATE POLICY "update_own_drip_steps" ON drip_steps FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM drip_campaigns WHERE drip_campaigns.id = drip_steps.campaign_id AND drip_campaigns.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM drip_campaigns WHERE drip_campaigns.id = drip_steps.campaign_id AND drip_campaigns.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_drip_steps" ON drip_steps;
CREATE POLICY "delete_own_drip_steps" ON drip_steps FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM drip_campaigns WHERE drip_campaigns.id = drip_steps.campaign_id AND drip_campaigns.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_drip_steps_campaign_id ON drip_steps(campaign_id);

-- 5. drip_enrollments
CREATE TABLE IF NOT EXISTS drip_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  current_step int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'unsubscribed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE drip_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_drip_enrollments" ON drip_enrollments;
CREATE POLICY "select_own_drip_enrollments" ON drip_enrollments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM drip_campaigns WHERE drip_campaigns.id = drip_enrollments.campaign_id AND drip_campaigns.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_drip_enrollments" ON drip_enrollments;
CREATE POLICY "insert_own_drip_enrollments" ON drip_enrollments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM drip_campaigns WHERE drip_campaigns.id = drip_enrollments.campaign_id AND drip_campaigns.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_drip_enrollments" ON drip_enrollments;
CREATE POLICY "update_own_drip_enrollments" ON drip_enrollments FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM drip_campaigns WHERE drip_campaigns.id = drip_enrollments.campaign_id AND drip_campaigns.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM drip_campaigns WHERE drip_campaigns.id = drip_enrollments.campaign_id AND drip_campaigns.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_drip_enrollments" ON drip_enrollments;
CREATE POLICY "delete_own_drip_enrollments" ON drip_enrollments FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM drip_campaigns WHERE drip_campaigns.id = drip_enrollments.campaign_id AND drip_campaigns.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_drip_enrollments_campaign_id ON drip_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_lead_id ON drip_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_status ON drip_enrollments(status);
