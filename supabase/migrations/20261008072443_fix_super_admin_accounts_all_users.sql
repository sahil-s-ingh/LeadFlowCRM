/*
# Fix super admin accounts to include ALL auth users

## Purpose
The previous get_super_admin_accounts() only returned users who had team_members.
Users who signed up but hadn't set up their CRM were invisible. This fixes that
by querying auth.users as the base and LEFT JOINing tenant data.

Also adds last_sign_in_at to each account row so the dashboard can show
active vs inactive status.
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
  -- Only super admins can call this
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access required';
  END IF;

  SELECT json_agg(
    json_build_object(
      'owner_id', u.id,
      'email', u.email,
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
    SELECT
      tm.owner_id,
      count(*) as team_count,
      count(*) FILTER (WHERE status = 'active') as active_team_count
    FROM public.team_members tm
    WHERE tm.owner_id IS NOT NULL
    GROUP BY tm.owner_id
  ) t ON t.owner_id = u.id
  LEFT JOIN (
    SELECT user_id, count(*) as lead_count
    FROM public.submissions
    WHERE deleted_at IS NULL AND user_id IS NOT NULL
    GROUP BY user_id
  ) s ON s.user_id = u.id
  LEFT JOIN (
    SELECT user_id, count(*) as conversation_count
    FROM public.chat_conversations
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  ) c ON c.user_id = u.id;

  RETURN COALESCE(result, '[]'::json);
END;
$$;
