-- Insert a platform-wide billing mode toggle.
-- is_enabled = true  → Paid mode (plans enforced, billing visible)
-- is_enabled = false → Free mode (everything unlimited, billing hidden)
INSERT INTO public.feature_toggles (key, label, description, category, is_enabled, is_public, sort_order)
VALUES (
  'platform_billing_mode',
  'Platform Billing Mode',
  'When ON: customers must buy a plan and limits are enforced. When OFF: the entire CRM is free and unlimited for all customers — no plans, no limits, no billing screen.',
  'general',
  true,
  false,
  -1
)
ON CONFLICT (key) DO NOTHING;
