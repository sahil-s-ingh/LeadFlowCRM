/*
# WhatsApp Credit System — part 2 (RPC functions)

Creates all SECURITY DEFINER functions for the credit system.
Tables were created in the preceding migration.
*/

-- ── get_wa_pricing: returns pricing config + packages for the customer UI ──
CREATE OR REPLACE FUNCTION public.get_wa_pricing()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pricing json;
  packages json;
BEGIN
  SELECT json_build_object(
    'marketing_rate', marketing_rate,
    'utility_rate', utility_rate,
    'authentication_rate', authentication_rate,
    'service_rate', service_rate,
    'marketing_markup', marketing_markup,
    'utility_markup', utility_markup,
    'authentication_markup', authentication_markup,
    'service_markup', service_markup,
    'currency', currency,
    'is_active', is_active
  ) INTO pricing
  FROM public.wa_message_pricing
  ORDER BY updated_at DESC LIMIT 1;

  SELECT COALESCE(json_agg(json_build_object(
    'id', id,
    'name', name,
    'credits', credits,
    'price', price,
    'currency', currency,
    'is_active', is_active,
    'sort_order', sort_order
  ) ORDER BY sort_order, price), '[]'::json) INTO packages
  FROM public.wa_credit_packages WHERE is_active = true;

  RETURN json_build_object(
    'pricing', COALESCE(pricing, '{}'::json),
    'packages', packages
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_wa_pricing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wa_pricing() TO authenticated;

-- ── admin_set_wa_pricing: super admin updates pricing ──
CREATE OR REPLACE FUNCTION public.admin_set_wa_pricing(
  p_marketing_rate numeric DEFAULT NULL,
  p_utility_rate numeric DEFAULT NULL,
  p_authentication_rate numeric DEFAULT NULL,
  p_service_rate numeric DEFAULT NULL,
  p_marketing_markup numeric DEFAULT NULL,
  p_utility_markup numeric DEFAULT NULL,
  p_authentication_markup numeric DEFAULT NULL,
  p_service_markup numeric DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing record;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access required';
  END IF;

  SELECT * INTO existing FROM public.wa_message_pricing ORDER BY updated_at DESC LIMIT 1;

  IF FOUND THEN
    UPDATE public.wa_message_pricing SET
      marketing_rate = COALESCE(p_marketing_rate, marketing_rate),
      utility_rate = COALESCE(p_utility_rate, utility_rate),
      authentication_rate = COALESCE(p_authentication_rate, authentication_rate),
      service_rate = COALESCE(p_service_rate, service_rate),
      marketing_markup = COALESCE(p_marketing_markup, marketing_markup),
      utility_markup = COALESCE(p_utility_markup, utility_markup),
      authentication_markup = COALESCE(p_authentication_markup, authentication_markup),
      service_markup = COALESCE(p_service_markup, service_markup),
      currency = COALESCE(p_currency, currency),
      is_active = COALESCE(p_is_active, is_active),
      updated_at = now()
    WHERE id = existing.id;
  ELSE
    INSERT INTO public.wa_message_pricing (
      marketing_rate, utility_rate, authentication_rate, service_rate,
      marketing_markup, utility_markup, authentication_markup, service_markup,
      currency, is_active
    ) VALUES (
      COALESCE(p_marketing_rate, 0),
      COALESCE(p_utility_rate, 0),
      COALESCE(p_authentication_rate, 0),
      COALESCE(p_service_rate, 0),
      COALESCE(p_marketing_markup, 0),
      COALESCE(p_utility_markup, 0),
      COALESCE(p_authentication_markup, 0),
      COALESCE(p_service_markup, 0),
      COALESCE(p_currency, 'INR'),
      COALESCE(p_is_active, false)
    );
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_wa_pricing(numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_wa_pricing(numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, boolean) TO authenticated;

-- ── admin_set_wa_package: super admin creates or updates a package ──
CREATE OR REPLACE FUNCTION public.admin_set_wa_package(
  p_package_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_credits integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_currency text DEFAULT 'INR',
  p_is_active boolean DEFAULT true,
  p_sort_order integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pkg_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access required';
  END IF;

  IF p_package_id IS NOT NULL THEN
    UPDATE public.wa_credit_packages SET
      name = COALESCE(p_name, name),
      credits = COALESCE(p_credits, credits),
      price = COALESCE(p_price, price),
      currency = COALESCE(p_currency, currency),
      is_active = COALESCE(p_is_active, is_active),
      sort_order = COALESCE(p_sort_order, sort_order)
    WHERE id = p_package_id RETURNING id INTO pkg_id;
  END IF;

  IF pkg_id IS NULL THEN
    INSERT INTO public.wa_credit_packages (name, credits, price, currency, is_active, sort_order)
    VALUES (p_name, p_credits, p_price, p_currency, p_is_active, p_sort_order)
    RETURNING id INTO pkg_id;
  END IF;

  RETURN json_build_object('success', true, 'package_id', pkg_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_wa_package(uuid, text, integer, numeric, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_wa_package(uuid, text, integer, numeric, text, boolean, integer) TO authenticated;

-- ── admin_delete_wa_package: super admin removes a package ──
CREATE OR REPLACE FUNCTION public.admin_delete_wa_package(p_package_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access required';
  END IF;
  DELETE FROM public.wa_credit_packages WHERE id = p_package_id;
  RETURN json_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_wa_package(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_wa_package(uuid) TO authenticated;

-- ── get_wa_credit_balance: returns current balance for the calling user ──
CREATE OR REPLACE FUNCTION public.get_wa_credit_balance()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal integer;
BEGIN
  SELECT balance INTO bal FROM public.wa_credit_balances WHERE user_id = auth.uid();
  RETURN COALESCE(bal, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_wa_credit_balance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wa_credit_balance() TO authenticated;

-- ── purchase_wa_credits: credits balance after verified payment ──
CREATE OR REPLACE FUNCTION public.purchase_wa_credits(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord record;
  new_balance integer;
BEGIN
  SELECT * INTO ord FROM public.wa_credit_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF ord.status = 'paid' THEN
    SELECT balance INTO new_balance FROM public.wa_credit_balances WHERE user_id = ord.user_id;
    RETURN json_build_object('success', true, 'already_credited', true, 'balance', COALESCE(new_balance, 0));
  END IF;

  UPDATE public.wa_credit_orders SET status = 'paid', updated_at = now() WHERE id = p_order_id;

  INSERT INTO public.wa_credit_balances (user_id, balance)
  VALUES (ord.user_id, ord.credits)
  ON CONFLICT (user_id) DO UPDATE SET
    balance = wa_credit_balances.balance + ord.credits,
    updated_at = now()
  RETURNING balance INTO new_balance;

  INSERT INTO public.wa_credit_transactions (user_id, type, credits, balance_after, reference)
  VALUES (ord.user_id, 'purchase', ord.credits, new_balance, 'Order ' || ord.id::text);

  RETURN json_build_object('success', true, 'balance', new_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_wa_credits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_wa_credits(uuid) TO authenticated;

-- ── deduct_wa_credits: deducts credits, rejects overdraft ──
CREATE OR REPLACE FUNCTION public.deduct_wa_credits(p_amount integer, p_reference text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  INSERT INTO public.wa_credit_balances (user_id, balance)
  VALUES (auth.uid(), 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wa_credit_balances
  SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = auth.uid() AND balance >= p_amount
  RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    SELECT balance INTO new_balance FROM public.wa_credit_balances WHERE user_id = auth.uid();
    RAISE EXCEPTION 'Insufficient credits: have %, need %', COALESCE(new_balance, 0), p_amount;
  END IF;

  INSERT INTO public.wa_credit_transactions (user_id, type, credits, balance_after, reference)
  VALUES (auth.uid(), 'deduction', -p_amount, new_balance, p_reference);

  RETURN json_build_object('success', true, 'balance', new_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_wa_credits(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_wa_credits(integer, text) TO authenticated;