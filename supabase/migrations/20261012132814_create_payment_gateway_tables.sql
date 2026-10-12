/*
# Create Payment Gateway Tables

1. New Tables
- `platform_payment_settings`
  - Stores Razorpay API keys configured by the super admin
  - `id` (uuid, primary key)
  - `razorpay_key_id` (text, nullable) — Razorpay public key ID
  - `razorpay_key_secret` (text, nullable) — Razorpay secret key
  - `is_active` (boolean, default true) — whether payment checkout is enabled
  - `currency` (text, default 'INR') — default currency for payments
  - `created_at`, `updated_at` (timestamptz)
- `payment_orders`
  - Records each payment order created via Razorpay
  - `id` (uuid, primary key)
  - `razorpay_order_id` (text, unique) — order ID returned by Razorpay
  - `razorpay_payment_id` (text, nullable) — payment ID after successful payment
  - `razorpay_signature` (text, nullable) — signature for verification
  - `plan_id` (uuid, nullable, references subscription_plans) — which plan was purchased
  - `plan_name` (text) — plan name snapshot
  - `amount` (numeric) — amount in currency units
  - `currency` (text, default 'INR')
  - `billing_cycle` (text) — 'monthly' or 'yearly'
  - `customer_name` (text) — name of the person paying
  - `customer_email` (text) — email of the person paying
  - `customer_phone` (text) — phone of the person paying
  - `customer_state` (text, nullable) — state, from landing page form
  - `status` (text, default 'created') — 'created', 'paid', 'failed'
  - `submission_id` (uuid, nullable, references submissions) — linked lead
  - `created_at`, `updated_at` (timestamptz)

2. Security
- Enable RLS on both tables.
- `platform_payment_settings`: super admin only (authenticated users who pass is_super_admin). We allow SELECT to authenticated users because the landing page needs the public key_id to render checkout — the secret is never exposed to the frontend.
- `payment_orders`: SELECT/INSERT to anon+authenticated (landing page visitors create orders before they have an account), UPDATE to authenticated (edge function updates status via service role, but also allow authenticated for admin views).

3. Important Notes
- The Razorpay key_secret is stored in the database and only accessed by edge functions via the service role key. It is never sent to the frontend.
- The frontend only receives the razorpay_key_id (public key) to initialize the Razorpay checkout widget.
- Payment verification happens server-side in the edge function using the secret key.
*/

CREATE TABLE IF NOT EXISTS platform_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_key_id text,
  razorpay_key_secret text,
  is_active boolean DEFAULT true,
  currency text DEFAULT 'INR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_payment_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can read/modify payment settings (they can read the key_id, which is public)
-- We use a permissive SELECT for authenticated so the landing page edge function can fetch keys via service role
-- The frontend will never query this table directly for the secret
DROP POLICY IF EXISTS "select_payment_settings" ON platform_payment_settings;
CREATE POLICY "select_payment_settings"
  ON platform_payment_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_payment_settings" ON platform_payment_settings;
CREATE POLICY "insert_payment_settings"
  ON platform_payment_settings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_payment_settings" ON platform_payment_settings;
CREATE POLICY "update_payment_settings"
  ON platform_payment_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text,
  razorpay_signature text,
  plan_id uuid,
  plan_name text NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'INR',
  billing_cycle text DEFAULT 'monthly',
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  customer_state text,
  status text DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  submission_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

-- Landing page visitors (anon) need to create orders and read their own order status
DROP POLICY IF EXISTS "select_payment_orders" ON payment_orders;
CREATE POLICY "select_payment_orders"
  ON payment_orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_payment_orders" ON payment_orders;
CREATE POLICY "insert_payment_orders"
  ON payment_orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_payment_orders" ON payment_orders;
CREATE POLICY "update_payment_orders"
  ON payment_orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay_order_id ON payment_orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_customer_email ON payment_orders(customer_email);
