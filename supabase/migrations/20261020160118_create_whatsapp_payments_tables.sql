/*
# WhatsApp Payments (India PG flow) — order_details messages

Adds native WhatsApp payment-request support so admins can send a
"Review and Pay" order_details message directly inside a WhatsApp
conversation. The customer pays via UPI / cards inside WhatsApp; Meta
notifies us via webhook and we record the payment status.

1. New Tables
- `wa_payment_config` — per-user link to a WhatsApp payment gateway
  configuration created in WhatsApp Manager (e.g. a Razorpay config).
  - `id` (uuid PK)
  - `user_id` (uuid, owner, defaults to auth.uid())
  - `payment_gateway_name` (text) — e.g. 'razorpay', 'payu', 'billdesk', 'zaakpay'
  - `configuration_name` (text) — the configuration name set in WhatsApp Manager
  - `is_active` (bool, default true)
  - `created_at`, `updated_at`
- `wa_payment_orders` — each payment request sent to a customer.
  - `id` (uuid PK)
  - `user_id` (uuid, owner, defaults to auth.uid())
  - `conversation_id` (uuid, nullable FK to wa_conversations)
  - `lead_id` (uuid, nullable FK to submissions)
  - `reference_id` (text, unique) — the reference_id sent in order_details
  - `wa_settings_id` (uuid, nullable) — which WhatsApp number was used
  - `amount_value` (integer) — paise value (offset 100)
  - `currency` (text, default 'INR')
  - `title` (text) — human label for the order
  - `status` (text) — pending | captured | failed | refunded
  - `gateway_name` (text)
  - `gateway_transaction_id` (text, nullable)
  - `paid_at` (timestamptz, nullable)
  - `meta_payload` (jsonb, nullable) — the raw interactive payload we sent
  - `created_at`, `updated_at`

2. Security
- RLS enabled on both tables.
- Owner-scoped CRUD via auth.uid() = user_id.
- 4 policies each (select/insert/update/delete), TO authenticated.
*/