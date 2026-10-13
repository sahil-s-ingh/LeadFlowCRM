/*
# Add signup phone visibility for super admins

## Purpose
Store the phone number provided during account creation in the existing Supabase Auth user metadata and expose it only through the existing super-admin account functions.

## Application-facing changes
- New sign-up metadata field: `phone` — the customer's phone number.
- `get_super_admin_accounts()` now returns `phone` for the account list and search.
- `get_super_admin_account_details(uuid)` now returns `phone` in the account detail drawer.

## Security
- No new public table or client-readable policy is created.
- Phone numbers are read only by the existing SECURITY DEFINER functions.
- Both functions continue to require `is_super_admin()` before returning account data.

## Important notes
1. Existing accounts without a phone number return `null` and remain valid.
2. The phone number is contact information only and is not used for authorization.
3. The sign-up form writes the value into Auth metadata alongside the user's name.
*/

CREATE OR REPLACE FUNCTION public.get_super_admin_accounts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access required';
  END IF;

  SELECT json_agg(
    json_build_object(
      'owner_id', u.id,
      'email', u.email,
      'phone', u.raw_user_meta_data->>'phone',
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      'team_count', COALESCE(t.team_count, 0),
      'active_team_count', COALESCE(t.active_team_count, 0),
      'lead_count', COALESCE(s.lead_count, 0),
      'conversation_count', COALESCE(c.conversation_count, 0)
    )
    ORDER BY u.created_at DESC
  ) INTO result
  FROM auth.users u
  LEFT JOIN (
    SELECT owner_id, count(*) as team_count,
      count(*) FILTER (WHERE status = 'active') as active_team_count
    FROM public.team_members WHERE owner_id IS NOT NULL
    GROUP BY owner_id
  ) t ON t.owner_id = u.id
  LEFT JOIN (
    SELECT user_id, count(*) as lead_count
    FROM public.submissions
    WHERE deleted_at IS NULL AND user_id IS NOT NULL
    GROUP BY user_id
  ) s ON s.user_id = u.id
  LEFT JOIN (
    SELECT user_id, count(*) as conversation_count
    FROM public.chat_conversations WHERE user_id IS NOT NULL
    GROUP BY user_id
  ) c ON c.user_id = u.id;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_super_admin_account_details(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  user_info record;
  team_members_list json;
  recent_leads_list json;
  revenue_stats json;
  status_counts json;
  activity_list json;
  total_revenue numeric;
  converted_count integer;
  total_leads integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access required';
  END IF;

  SELECT id, email, raw_user_meta_data->>'phone' AS phone, created_at, last_sign_in_at
  INTO user_info
  FROM auth.users
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'id', tm.id,
    'email', tm.email,
    'role', tm.role,
    'full_name', tm.full_name,
    'status', tm.status,
    'created_at', tm.created_at
  ) ORDER BY tm.created_at DESC), '[]'::json)
  INTO team_members_list
  FROM public.team_members tm
  WHERE tm.owner_id = target_user_id;

  SELECT COALESCE(json_agg(json_build_object(
    'id', s.id,
    'name', s.name,
    'email', s.email,
    'mobile_number', s.mobile_number,
    'status', s.status,
    'fund_amount', s.fund_amount,
    'purchase_value', s.purchase_value,
    'assigned_to', s.assigned_to,
    'created_at', s.created_at
  ) ORDER BY s.created_at DESC), '[]'::json)
  INTO recent_leads_list
  FROM (
    SELECT * FROM public.submissions
    WHERE user_id = target_user_id AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 20
  ) s;

  SELECT
    COALESCE(SUM(s.purchase_value), 0),
    COUNT(*) FILTER (WHERE s.purchase_value IS NOT NULL AND s.purchase_value > 0),
    COUNT(*)
  INTO total_revenue, converted_count, total_leads
  FROM public.submissions s
  WHERE s.user_id = target_user_id AND s.deleted_at IS NULL;

  revenue_stats := json_build_object(
    'total_revenue', total_revenue,
    'converted_count', converted_count,
    'total_leads', total_leads,
    'avg_deal_size', CASE WHEN converted_count > 0 THEN total_revenue / converted_count ELSE 0 END
  );

  SELECT COALESCE(json_object_agg(COALESCE(s.status, 'unknown'), cnt), '{}'::json)
  INTO status_counts
  FROM (
    SELECT COALESCE(status, 'unknown') as status, count(*) as cnt
    FROM public.submissions
    WHERE user_id = target_user_id AND deleted_at IS NULL
    GROUP BY status
  ) s;

  SELECT COALESCE(json_agg(json_build_object(
    'id', la.id,
    'activity_type', la.activity_type,
    'description', la.description,
    'created_at', la.created_at
  ) ORDER BY la.created_at DESC), '[]'::json)
  INTO activity_list
  FROM (
    SELECT * FROM public.lead_activities
    WHERE user_id = target_user_id
    ORDER BY created_at DESC LIMIT 20
  ) la;

  result := json_build_object(
    'user', json_build_object(
      'id', user_info.id,
      'email', user_info.email,
      'phone', user_info.phone,
      'created_at', user_info.created_at,
      'last_sign_in_at', user_info.last_sign_in_at
    ),
    'team_members', team_members_list,
    'recent_leads', recent_leads_list,
    'revenue', revenue_stats,
    'status_counts', status_counts,
    'activity', activity_list
  );

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_super_admin_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_super_admin_accounts() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_super_admin_account_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_super_admin_account_details(uuid) TO authenticated;