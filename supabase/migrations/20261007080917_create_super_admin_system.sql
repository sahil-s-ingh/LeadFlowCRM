/*
# Super Admin System

## Purpose
Creates a super admin portal separate from the CRM. The super admin can see
how many CRM accounts exist, how many users are active, and how many are
on-boarded (signed up). This is a platform-owner-level view across all CRM tenants.

## New Tables
- `super_admins`
  - `id` (uuid, primary key, references auth.users)
  - `email` (text, unique)
  - `created_at` (timestamp)

## Security
- RLS enabled on `super_admins`.
- Only authenticated users who exist in `super_admins` can read the table.
- No INSERT/UPDATE/DELETE via API — super admins are managed via SQL directly.
- A SECURITY DEFINER function `is_super_admin()` checks if the current
  authenticated user is a super admin. Used by the dashboard edge function.
- A SECURITY DEFINER function `get_super_admin_stats()` returns aggregate
  counts across all CRM tenants. Only callable by super admins.

## Important Notes
1. To add yourself as super admin, run:
   INSERT INTO super_admins (id, email) VALUES ('<your-auth-uuid>', 'your@email.com');
2. The stats function queries auth.users (via the service role in edge functions)
   and tenant tables to compute totals.
*/

CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admins_self_read" ON super_admins;
CREATE POLICY "super_admins_self_read"
ON super_admins FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Function to check if current user is a super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE id = auth.uid()
  );
$$;

-- Function to get super admin dashboard stats
-- Returns counts of CRM accounts, active users, team members, etc.
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
  -- Only super admins can call this
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access required';
  END IF;

  -- Count all auth users (distinct owners of CRM accounts)
  SELECT count(*) INTO total_auth_users
  FROM auth.users;

  -- Count total leads across all tenants
  SELECT count(*) INTO total_submissions
  FROM public.submissions
  WHERE deleted_at IS NULL;

  -- Count total team members across all tenants
  SELECT count(*) INTO total_team_members
  FROM public.team_members;

  -- Count active team members
  SELECT count(*) INTO active_team_members
  FROM public.team_members
  WHERE status = 'active';

  -- Count conversations
  SELECT count(*) INTO total_conversations
  FROM public.chat_conversations;

  -- Count distinct accounts (users who own team_members)
  SELECT count(DISTINCT owner_id) INTO account_count
  FROM public.team_members
  WHERE owner_id IS NOT NULL;

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

-- Function to get per-account breakdown
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
      'owner_id', t.owner_id,
      'team_count', t.team_count,
      'active_team_count', t.active_team_count,
      'lead_count', COALESCE(s.lead_count, 0),
      'conversation_count', COALESCE(c.conversation_count, 0)
    )
  ) INTO result
  FROM (
    SELECT
      tm.owner_id,
      count(*) as team_count,
      count(*) FILTER (WHERE status = 'active') as active_team_count
    FROM public.team_members tm
    WHERE tm.owner_id IS NOT NULL
    GROUP BY tm.owner_id
  ) t
  LEFT JOIN (
    SELECT user_id, count(*) as lead_count
    FROM public.submissions
    WHERE deleted_at IS NULL AND user_id IS NOT NULL
    GROUP BY user_id
  ) s ON s.user_id = t.owner_id
  LEFT JOIN (
    SELECT user_id, count(*) as conversation_count
    FROM public.chat_conversations
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  ) c ON c.user_id = t.owner_id;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Grant execute to authenticated only
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_super_admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_super_admin_stats() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_super_admin_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_super_admin_accounts() TO authenticated;
