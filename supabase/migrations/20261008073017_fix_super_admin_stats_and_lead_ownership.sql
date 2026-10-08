/*
# Fix super admin dashboard - accounts, stats, and lead ownership

## Problems
1. submissions table has no user_id column — leads can't be linked to accounts
2. get_super_admin_stats counts accounts from team_members (empty = 0 accounts)
3. get_super_admin_accounts joins on submissions.user_id which doesn't exist

## Fixes
1. Add user_id column to submissions, backfill from assigned_to -> team_members.owner_id
2. Update get_super_admin_stats to count accounts from auth.users
3. Update get_super_admin_accounts to use the new user_id column
*/

-- 1. Add user_id to submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: link existing leads to their account owner via assigned_to -> team_members.owner_id
UPDATE public.submissions s
SET user_id = tm.owner_id
FROM public.team_members tm
WHERE s.assigned_to = tm.id
  AND s.user_id IS NULL;

-- 2. Fix get_super_admin_stats to count from auth.users
CREATE OR REPLACE FUNCTION public.get_super_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  total_auth_users integer;
  total_submissions integer;
  total_team_members integer;
  active_team_members integer;
  total_conversations integer;
  account_count integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access required';
  END IF;

  SELECT count(*) INTO total_auth_users FROM auth.users;
  SELECT count(*) INTO total_submissions FROM public.submissions WHERE deleted_at IS NULL;
  SELECT count(*) INTO total_team_members FROM public.team_members;
  SELECT count(*) INTO active_team_members FROM public.team_members WHERE status = 'active';
  SELECT count(*) INTO total_conversations FROM public.chat_conversations;
  SELECT count(*) INTO account_count FROM auth.users;

  result := json_build_object(
    'total_auth_users', total_auth_users,
    'total_submissions', total_submissions,
    'total_team_members', total_team_members,
    'active_team_members', active_team_members,
    'total_conversations', total_conversations,
    'account_count', account_count
  );

  RETURN result;
END;
$$;

-- 3. Fix get_super_admin_accounts to use user_id on submissions
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

-- Re-grant (CREATE OR REPLACE drops grants)
REVOKE EXECUTE ON FUNCTION public.get_super_admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_super_admin_stats() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_super_admin_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_super_admin_accounts() TO authenticated;
