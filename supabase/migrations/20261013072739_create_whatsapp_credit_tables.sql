/*
# WhatsApp Credit System — part 1 (tables + RLS only)

Creates the tables and RLS policies for the WhatsApp credit system.
RPC functions are created in a follow-up migration to avoid
function-signature resolution issues during the CREATE OR REPLACE chain.
*/

-- ─────────────────────── wa_message_pricing ───────────────────────
CREATE TABLE IF NOT EXISTS public.wa_message_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_rate numeric NOT NULL DEFAULT 0.00,
  utility_rate numeric NOT NULL DEFAULT 0.00,
  authentication_rate numeric NOT NULL DEFAULT 0.00,
  service_rate numeric NOT NULL DEFAULT 0.00,
  marketing_markup numeric NOT NULL DEFAULT 0.00,
  utility_markup numeric NOT NULL DEFAULT 0.00,
  authentication_markup numeric NOT NULL DEFAULT 0.00,
  service_markup numeric NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'INR',
  is_active boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.wa_message_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_wa_pricing" ON public.wa_message_pricing;
CREATE POLICY "select_wa_pricing" ON public.wa_message_pricing
  FOR SELECT TO authenticated USING (true);

-- ─────────────────────── wa_credit_packages ───────────────────────
CREATE TABLE IF NOT EXISTS public.wa_credit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  price numeric NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'INR',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.wa_credit_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_wa_packages" ON public.wa_credit_packages;
CREATE POLICY "select_wa_packages" ON public.wa_credit_packages
  FOR SELECT TO authenticated USING (true);

-- ─────────────────────── wa_credit_balances ───────────────────────
CREATE TABLE IF NOT EXISTS public.wa_credit_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.wa_credit_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_balance" ON public.wa_credit_balances;
CREATE POLICY "select_own_wa_balance" ON public.wa_credit_balances
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ─────────────────────── wa_credit_orders ───────────────────────
CREATE TABLE IF NOT EXISTS public.wa_credit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text,
  razorpay_signature text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.wa_credit_packages(id) ON DELETE SET NULL,
  package_name text NOT NULL,
  credits integer NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.wa_credit_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_credit_orders" ON public.wa_credit_orders;
CREATE POLICY "select_own_wa_credit_orders" ON public.wa_credit_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_credit_orders" ON public.wa_credit_orders;
CREATE POLICY "insert_own_wa_credit_orders" ON public.wa_credit_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wa_credit_orders" ON public.wa_credit_orders;
CREATE POLICY "update_own_wa_credit_orders" ON public.wa_credit_orders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_credit_orders_user_id ON public.wa_credit_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_credit_orders_razorpay_order_id ON public.wa_credit_orders(razorpay_order_id);

-- ─────────────────────── wa_credit_transactions ───────────────────────
CREATE TABLE IF NOT EXISTS public.wa_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase','deduction','refund','adjustment')),
  credits integer NOT NULL,
  balance_after integer NOT NULL,
  reference text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.wa_credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_credit_txns" ON public.wa_credit_transactions;
CREATE POLICY "select_own_wa_credit_txns" ON public.wa_credit_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_credit_txns_user_id ON public.wa_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_credit_txns_created_at ON public.wa_credit_transactions(created_at DESC);