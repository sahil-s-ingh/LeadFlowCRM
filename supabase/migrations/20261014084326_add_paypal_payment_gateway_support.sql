/*
# Add PayPal Payment Gateway Support

1. Modified Tables
- `platform_payment_settings`
  - Add `paypal_client_id` (text, nullable) — PayPal REST API Client ID
  - Add `paypal_client_secret` (text, nullable) — PayPal REST API Client Secret (server-side, never exposed to frontend)
  - Add `paypal_environment` (text, default 'production') — 'production' or 'sandbox'
  - Update `active_gateway` CHECK constraint to allow 'paypal' in addition to 'razorpay' and 'phonepe'
- `payment_orders`
  - Add `paypal_order_id` (text, nullable) — PayPal order ID returned during order creation
  - Add `paypal_capture_id` (text, nullable) — PayPal capture ID returned after payment capture
  - Update `gateway` CHECK constraint to allow 'paypal'

2. Security
- No new tables. RLS already enabled on both tables.
- PayPal client secret is stored in the database and only accessed by edge functions via the service role key. It is never sent to the frontend.
- Existing policies remain unchanged.

3. Important Notes
- PayPal uses a redirect-based flow: user is redirected to PayPal to approve the payment, then returned to the site.
- PayPal Orders API v2 is used for order creation and payment capture.
- The `active_gateway` column now supports three values: 'razorpay', 'phonepe', 'paypal'.
- PayPal supports multiple currencies natively (USD, EUR, GBP, INR, etc.).
*/

-- Add PayPal columns to platform_payment_settings
ALTER TABLE platform_payment_settings
  ADD COLUMN IF NOT EXISTS paypal_client_id text;

ALTER TABLE platform_payment_settings
  ADD COLUMN IF NOT EXISTS paypal_client_secret text;

ALTER TABLE platform_payment_settings
  ADD COLUMN IF NOT EXISTS paypal_environment text DEFAULT 'production' CHECK (paypal_environment IN ('production', 'sandbox'));

-- Update active_gateway CHECK to include 'paypal'
ALTER TABLE platform_payment_settings DROP CONSTRAINT IF EXISTS platform_payment_settings_active_gateway_check;
ALTER TABLE platform_payment_settings ADD CONSTRAINT platform_payment_settings_active_gateway_check
  CHECK (active_gateway IN ('razorpay', 'phonepe', 'paypal'));

-- Add PayPal columns to payment_orders
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS paypal_order_id text;

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS paypal_capture_id text;

-- Update gateway CHECK to include 'paypal'
ALTER TABLE payment_orders DROP CONSTRAINT IF EXISTS payment_orders_gateway_check;
ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_gateway_check
  CHECK (gateway IN ('razorpay', 'phonepe', 'paypal'));

-- Index for PayPal order lookups
CREATE INDEX IF NOT EXISTS idx_payment_orders_paypal_order_id ON payment_orders(paypal_order_id);
