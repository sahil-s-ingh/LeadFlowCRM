/*
# Create plan_features junction table

## What changed
Creates a many-to-many junction table linking subscription_plans to feature_toggles.
This lets the super admin assign specific platform features to each plan —
e.g. Free gets basic features, Pro gets WhatsApp Calling + Automation Builder, etc.

## Security
- Readable by everyone (public — pricing page needs to show what each plan includes).
- Writable only by super admins (same pattern as subscription_plans and feature_toggles).
*/

CREATE TABLE IF NOT EXISTS public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_key)
);

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_plan_features" ON public.plan_features;
CREATE POLICY "public_read_plan_features"
  ON public.plan_features FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "super_admin_insert_plan_features" ON public.plan_features;
CREATE POLICY "super_admin_insert_plan_features"
  ON public.plan_features FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_delete_plan_features" ON public.plan_features;
CREATE POLICY "super_admin_delete_plan_features"
  ON public.plan_features FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_plan_features_plan_id ON public.plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_feature_key ON public.plan_features(feature_key);
