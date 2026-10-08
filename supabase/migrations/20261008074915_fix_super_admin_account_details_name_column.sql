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

  -- Get user info
  SELECT id, email, created_at, last_sign_in_at
  INTO user_info
  FROM auth.users
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Team members
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

  -- Recent leads (last 20)
  SELECT COALESCE(json_agg(json_build_object(
    'id', s.id,
    'name', s.full_name,
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

  -- Revenue stats
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

  -- Lead status breakdown
  SELECT COALESCE(json_object_agg(COALESCE(s.status, 'unknown'), cnt), '{}'::json)
  INTO status_counts
  FROM (
    SELECT COALESCE(status, 'unknown') as status, count(*) as cnt
    FROM public.submissions
    WHERE user_id = target_user_id AND deleted_at IS NULL
    GROUP BY status
  ) s;

  -- Recent activity (last 20)
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

REVOKE EXECUTE ON FUNCTION public.get_super_admin_account_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_super_admin_account_details(uuid) TO authenticated;
