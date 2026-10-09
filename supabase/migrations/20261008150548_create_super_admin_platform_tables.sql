/*
# Create platform tables: subscription plans, account subscriptions, feature toggles, and legal pages

## What changed
This migration creates four new tables for the super admin platform management system:

1. **subscription_plans** — Stores pricing plans (Free, Starter, Pro, Enterprise) with
   monthly/annual prices, lead limits, team seat limits, feature lists, and display settings.
2. **account_subscriptions** — Links a user (auth.users id) to a subscription plan with
   status, billing cycle, and renewal dates. Only one active subscription per user.
3. **feature_toggles** — Platform-wide feature flags that can be enabled/disabled. Each
   toggle has a key, label, description, default state, and whether it's editable per plan.
4. **legal_pages** — Stores editable legal content (Terms, Privacy, Refund, Cookie policy)
   with rich text content, slug, and last-updated timestamp.

## Security
- All four tables use RLS.
- subscription_plans: readable by everyone (public pricing page), writable only by super admins.
- account_subscriptions: readable by the account owner and super admins, writable by super admins.
- feature_toggles: readable by everyone, writable only by super admins.
- legal_pages: readable by everyone (public legal pages), writable only by super admins.
- Super admin check uses the existing `is_super_admin()` SECURITY DEFINER function.
*/

-- ===================== subscription_plans =====================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  annual_price numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  lead_limit integer NOT NULL DEFAULT 1000,
  team_seats integer NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_label text NOT NULL DEFAULT 'Get Started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_subscription_plans" ON public.subscription_plans;
CREATE POLICY "public_read_subscription_plans"
  ON public.subscription_plans FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "super_admin_write_subscription_plans" ON public.subscription_plans;
CREATE POLICY "super_admin_write_subscription_plans"
  ON public.subscription_plans FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_update_subscription_plans" ON public.subscription_plans;
CREATE POLICY "super_admin_update_subscription_plans"
  ON public.subscription_plans FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_delete_subscription_plans" ON public.subscription_plans;
CREATE POLICY "super_admin_delete_subscription_plans"
  ON public.subscription_plans FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- ===================== account_subscriptions =====================
CREATE TABLE IF NOT EXISTS public.account_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'past_due', 'canceled', 'expired')),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.account_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read_subscriptions" ON public.account_subscriptions;
CREATE POLICY "owner_read_subscriptions"
  ON public.account_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_write_subscriptions" ON public.account_subscriptions;
CREATE POLICY "super_admin_write_subscriptions"
  ON public.account_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_update_subscriptions" ON public.account_subscriptions;
CREATE POLICY "super_admin_update_subscriptions"
  ON public.account_subscriptions FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_delete_subscriptions" ON public.account_subscriptions;
CREATE POLICY "super_admin_delete_subscriptions"
  ON public.account_subscriptions FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- ===================== feature_toggles =====================
CREATE TABLE IF NOT EXISTS public.feature_toggles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  is_enabled boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_toggles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_feature_toggles" ON public.feature_toggles;
CREATE POLICY "public_read_feature_toggles"
  ON public.feature_toggles FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "super_admin_write_feature_toggles" ON public.feature_toggles;
CREATE POLICY "super_admin_write_feature_toggles"
  ON public.feature_toggles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_update_feature_toggles" ON public.feature_toggles;
CREATE POLICY "super_admin_update_feature_toggles"
  ON public.feature_toggles FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_delete_feature_toggles" ON public.feature_toggles;
CREATE POLICY "super_admin_delete_feature_toggles"
  ON public.feature_toggles FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- ===================== legal_pages =====================
CREATE TABLE IF NOT EXISTS public.legal_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  content text NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_legal_pages" ON public.legal_pages;
CREATE POLICY "public_read_legal_pages"
  ON public.legal_pages FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "super_admin_write_legal_pages" ON public.legal_pages;
CREATE POLICY "super_admin_write_legal_pages"
  ON public.legal_pages FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_update_legal_pages" ON public.legal_pages;
CREATE POLICY "super_admin_update_legal_pages"
  ON public.legal_pages FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_delete_legal_pages" ON public.legal_pages;
CREATE POLICY "super_admin_delete_legal_pages"
  ON public.legal_pages FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- ===================== Seed default plans =====================
INSERT INTO public.subscription_plans (name, slug, description, monthly_price, annual_price, lead_limit, team_seats, is_active, is_featured, sort_order, features, cta_label)
VALUES
  ('Free', 'free', 'Perfect for getting started with lead management', 0, 0, 100, 1, true, false, 0, '["Up to 100 leads","1 team member","Basic pipeline view","WhatsApp integration","Email support"]'::jsonb, 'Start Free'),
  ('Starter', 'starter', 'For small teams starting to scale their sales', 29, 290, 1000, 3, true, false, 1, '["Up to 1,000 leads","3 team members","Visual pipeline","WhatsApp & Telegram broadcast","Email automation","Follow-up scheduling","Priority support"]'::jsonb, 'Start Trial'),
  ('Pro', 'pro', 'For growing sales teams that need more power', 79, 790, 10000, 10, true, true, 2, '["Up to 10,000 leads","10 team members","Everything in Starter","WhatsApp calling","Automation builder","Lead scoring","Revenue forecasting","Analytics hub","Custom popup forms","API access"]'::jsonb, 'Start Trial'),
  ('Enterprise', 'enterprise', 'For large teams with advanced needs', 199, 1990, 100000, 50, true, false, 3, '["Unlimited leads","50 team members","Everything in Pro","Multi-workspace","Advanced automations","Meta marketing sync","Google Sheets sync","Dedicated support","Custom integrations","SLA guarantee"]'::jsonb, 'Contact Sales')
ON CONFLICT (slug) DO NOTHING;

-- ===================== Seed default feature toggles =====================
INSERT INTO public.feature_toggles (key, label, description, category, is_enabled, sort_order)
VALUES
  ('whatsapp_calling', 'WhatsApp Calling', 'Enable in-app WhatsApp voice calls', 'communication', true, 0),
  ('email_broadcast', 'Email Broadcast', 'Send bulk emails to leads', 'communication', true, 1),
  ('whatsapp_broadcast', 'WhatsApp Broadcast', 'Send bulk WhatsApp messages', 'communication', true, 2),
  ('telegram_broadcast', 'Telegram Broadcast', 'Send bulk Telegram messages', 'communication', true, 3),
  ('automation_builder', 'Automation Builder', 'Create automated workflows', 'automation', true, 4),
  ('pipeline_autoassign', 'Pipeline Auto-Assign', 'Automatically assign leads by stage', 'automation', true, 5),
  ('lead_scoring', 'Lead Scoring', 'Score leads based on activity', 'analytics', true, 6),
  ('revenue_forecast', 'Revenue Forecasting', 'Project revenue from pipeline', 'analytics', true, 7),
  ('analytics_hub', 'Analytics Hub', 'Advanced analytics dashboard', 'analytics', true, 8),
  ('google_sheets_sync', 'Google Sheets Sync', 'Sync leads to Google Sheets', 'integrations', true, 9),
  ('meta_marketing', 'Meta Marketing Sync', 'Sync leads with Meta Ads', 'integrations', true, 10),
  ('popup_form_builder', 'Popup Form Builder', 'Create custom lead capture forms', 'leads', true, 11),
  ('ib_leads', 'IB Lead Applications', 'Introducing Broker application system', 'leads', true, 12),
  ('team_chat', 'Team Chat', 'Internal team messaging', 'team', true, 13),
  ('agent_leaderboard', 'Agent Leaderboard', 'Rank team members by performance', 'team', true, 14),
  ('goal_tracking', 'Goal Tracking', 'Set and track sales targets', 'team', true, 15),
  ('win_loss_analysis', 'Win/Loss Analysis', 'Analyze won and lost deals', 'analytics', true, 16)
ON CONFLICT (key) DO NOTHING;

-- ===================== Seed default legal pages =====================
INSERT INTO public.legal_pages (slug, title, subtitle, content, is_published, sort_order)
VALUES
  ('terms', 'Terms & Conditions', 'Last updated: October 8, 2026', '<h2>1. Acceptance of Terms</h2><p>By creating an account or using LeadCentre CRM, you agree to these Terms & Conditions. If you do not agree, you may not use the platform.</p><h2>2. Description of Service</h2><p>LeadCentre CRM provides a cloud-based sales and lead management platform including pipeline management, WhatsApp and email broadcast, automated follow-ups, analytics, team collaboration, and integration features.</p><h2>3. Account Responsibilities</h2><ul><li>You must provide accurate registration information</li><li>You are responsible for maintaining account security</li><li>You are responsible for all activities under your account</li><li>You must be at least 18 years old</li></ul><h2>4. Acceptable Use</h2><p>You agree not to use the platform for spam, illegal activities, or sending unsolicited communications.</p><h2>5. Subscriptions & Billing</h2><p>Paid plans are billed monthly or annually. You can cancel at any time. Refunds are subject to our Refund Policy.</p><h2>6. Data & Privacy</h2><p>Your use of the platform is also governed by our Privacy Policy.</p><h2>7. Limitation of Liability</h2><p>LeadCentre CRM is provided "as is" without warranties. We are not liable for indirect or consequential damages.</p><h2>8. Contact</h2><p>For questions about these terms, email support@leadcentrecrm.com</p>', true, 0),
  ('privacy', 'Privacy Policy', 'Last updated: October 8, 2026', '<h2>1. Information We Collect</h2><p>We collect information you provide when creating an account, including name, email, phone, and company details. We also collect lead data you import or capture.</p><h2>2. How We Use Your Information</h2><p>To provide and improve the platform, send notifications on your behalf, provide analytics, and communicate updates.</p><h2>3. Data Storage & Security</h2><p>Your data is stored on encrypted servers with AES-256 encryption at rest and TLS 1.2+ in transit. Access is protected by Row Level Security.</p><h2>4. Data Sharing</h2><p>We never sell your data. We share only with service providers under strict agreements and law enforcement when required.</p><h2>5. Your Rights</h2><p>You can access, correct, export, or delete your data at any time. Account deletion permanently removes data within 30 days.</p><h2>6. Contact</h2><p>For privacy questions, email privacy@leadcentrecrm.com</p>', true, 1),
  ('refund', 'Refund Policy', 'Last updated: October 8, 2026', '<h2>Refund Policy</h2><p>We offer a 14-day free trial on all paid plans. No payment is required during the trial period.</p><h2>Monthly Subscriptions</h2><p>Monthly subscriptions are non-refundable. You can cancel at any time and continue using the platform until the end of your billing period.</p><h2>Annual Subscriptions</h2><p>Annual subscriptions are eligible for a pro-rata refund within 14 days of payment, minus usage for the active period. After 14 days, annual subscriptions are non-refundable.</p><h2>How to Request a Refund</h2><p>Email billing@leadcentrecrm.com with your account email and reason for the refund request.</p>', true, 2),
  ('cookies', 'Cookie Policy', 'Last updated: October 8, 2026', '<h2>Cookie Policy</h2><p>We use cookies to operate the platform and improve your experience.</p><h2>Essential Cookies</h2><p>Used for authentication and session management. Required for the platform to function.</p><h2>Analytics Cookies</h2><p>Used to understand how the platform is used and improve features.</p><h2>Managing Cookies</h2><p>You can control cookie preferences through your browser settings. Disabling essential cookies will prevent you from using the platform.</p>', true, 3)
ON CONFLICT (slug) DO NOTHING;

-- Add updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS account_subscriptions_updated_at ON public.account_subscriptions;
CREATE TRIGGER account_subscriptions_updated_at
  BEFORE UPDATE ON public.account_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS feature_toggles_updated_at ON public.feature_toggles;
CREATE TRIGGER feature_toggles_updated_at
  BEFORE UPDATE ON public.feature_toggles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS legal_pages_updated_at ON public.legal_pages;
CREATE TRIGGER legal_pages_updated_at
  BEFORE UPDATE ON public.legal_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
