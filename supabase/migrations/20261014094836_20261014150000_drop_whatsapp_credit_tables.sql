-- Remove WhatsApp Credits system: tables, functions, and pricing config
-- This drops all wa_credit_* tables and related RPC functions.

-- Drop RPC functions first (they depend on the tables)
DROP FUNCTION IF EXISTS get_wa_credit_balance();
DROP FUNCTION IF EXISTS deduct_wa_credits(p_amount integer, p_reference text);
DROP FUNCTION IF EXISTS add_wa_credits(p_amount integer, p_reference text, p_package_id uuid);
DROP FUNCTION IF EXISTS process_wa_credit_order(p_order_id text, p_payment_id text, p_signature text);

-- Drop tables
DROP TABLE IF EXISTS wa_credit_orders CASCADE;
DROP TABLE IF EXISTS wa_credit_packages CASCADE;
DROP TABLE IF EXISTS wa_credit_ledger CASCADE;
DROP TABLE IF EXISTS wa_credit_balances CASCADE;
DROP TABLE IF EXISTS wa_message_pricing CASCADE;