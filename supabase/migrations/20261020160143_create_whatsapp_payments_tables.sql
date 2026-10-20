/*
# WhatsApp Payments (India PG flow) — order_details messages

Adds native WhatsApp payment-request support so admins can send a
"Review and Pay" order_details message directly inside a WhatsApp
conversation. The customer pays via UPI / cards inside WhatsApp; Meta
notifies us via webhook and we record the payment status.

1. New Tables
- `wa_payment_config` — per-user link to a WhatsApp payment gateway
  configuration created in WhatsApp Manager (e.g. a Razorpay config).
- `wa_payment_orders` — each payment request sent to a customer, tracked
  by reference_id, with status pending -> captured/failed.

2. Security
- RLS enabled on both tables.
- Owner-scoped CRUD via auth.uid() = user_id.
- 4 policies each (select/insert/update/delete), TO authenticated.
*/

CREATE TABLE IF NOT EXISTS wa_payment_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_gateway_name text NOT NULL DEFAULT 'razorpay',
  configuration_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wa_payment_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_payment_config" ON wa_payment_config;
CREATE POLICY "select_own_wa_payment_config" ON wa_payment_config FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_payment_config" ON wa_payment_config;
CREATE POLICY "insert_own_wa_payment_config" ON wa_payment_config FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wa_payment_config" ON wa_payment_config;
CREATE POLICY "update_own_wa_payment_config" ON wa_payment_config FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wa_payment_config" ON wa_payment_config;
CREATE POLICY "delete_own_wa_payment_config" ON wa_payment_config FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS wa_payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES wa_conversations(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  reference_id text UNIQUE NOT NULL,
  wa_settings_id uuid,
  amount_value integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  title text NOT NULL DEFAULT 'Payment Request',
  status text NOT NULL DEFAULT 'pending',
  gateway_name text NOT NULL DEFAULT 'razorpay',
  gateway_transaction_id text,
  paid_at timestamptz,
  meta_payload jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wa_payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wa_payment_orders" ON wa_payment_orders;
CREATE POLICY "select_own_wa_payment_orders" ON wa_payment_orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wa_payment_orders" ON wa_payment_orders;
CREATE POLICY "insert_own_wa_payment_orders" ON wa_payment_orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wa_payment_orders" ON wa_payment_orders;
CREATE POLICY "update_own_wa_payment_orders" ON wa_payment_orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wa_payment_orders" ON wa_payment_orders;
CREATE POLICY "delete_own_wa_payment_orders" ON wa_payment_orders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wa_payment_orders_user ON wa_payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_payment_orders_conv ON wa_payment_orders(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_payment_orders_status ON wa_payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_wa_payment_config_user ON wa_payment_config(user_id);

-- Enable realtime so the drawer updates when a payment is captured
ALTER PUBLICATION supabase_realtime ADD TABLE wa_payment_orders;