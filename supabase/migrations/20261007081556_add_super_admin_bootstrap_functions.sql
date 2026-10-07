/*
# Super Admin Bootstrap & Management Functions

## Purpose
Fixes the "Not Authorized" issue. Adds:
1. A bootstrap function — if no super admins exist yet, the first authenticated
   user who calls it becomes super admin automatically. This solves the
   chicken-and-egg problem of the first super admin needing to be created.
2. A function to list all auth users (for the dashboard) — auth.users is not
   readable by normal queries, so a SECURITY DEFINER function is needed.
3. A function to promote another user by email (callable by existing super admins).

## Security
- `bootstrap_super_admin()`: If super_admins table is empty, promotes the caller.
  If not empty, does nothing (returns false). SECURITY DEFINER.
- `get_all_auth_users()`: Returns id, email, created_at, last_sign_in_at from
  auth.users. Only callable by super admins. SECURITY DEFINER.
- `promote_super_admin(p_email)`: Adds a user to super_admins by email.
  Only callable by existing super admins. SECURITY DEFINER.
- `demote_super_admin(p_email)`: Removes a user from super_admins by email.
  Only callable by existing super admins. SECURITY DEFINER.
*/

-- Bootstrap: first user to call this when no super admins exist becomes super admin
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count integer;
  current_email text;
BEGIN
  SELECT count(*) INTO admin_count FROM public.super_admins;

  IF admin_count > 0 THEN
    RETURN false;
  END IF;

  SELECT email INTO current_email FROM auth.users WHERE id = auth.uid();
  IF current_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  INSERT INTO public.super_admins (id, email)
  VALUES (auth.uid(), current_email)
  ON CONFLICT (id) DO NOTHING;

  RETURN true;
END;
$$;

-- Get all auth users (for super admin dashboard)
CREATE OR REPLACE FUNCTION public.get_all_auth_users()
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
      'id', id,
      'email', email,
      'created_at', created_at,
      'last_sign_in_at', last_sign_in_at
    )
  ) INTO result
  FROM auth.users;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Promote a user to super admin by email (only existing super admins)
CREATE OR REPLACE FUNCTION public.promote_super_admin(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access required';
  END IF;

  SELECT id INTO target_id FROM auth.users WHERE email = p_email;
  IF target_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', p_email;
  END IF;

  INSERT INTO public.super_admins (id, email)
  VALUES (target_id, p_email)
  ON CONFLICT (id) DO NOTHING;

  RETURN true;
END;
$$;

-- Demote a super admin by email (only existing super admins)
CREATE OR REPLACE FUNCTION public.demote_super_admin(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access required';
  END IF;

  SELECT count(*) INTO admin_count FROM public.super_admins;
  IF admin_count <= 1 THEN
    RAISE EXCEPTION 'Cannot demote the last super admin';
  END IF;

  DELETE FROM public.super_admins WHERE email = p_email;

  RETURN true;
END;
$$;

-- Grant execute to authenticated
REVOKE EXECUTE ON FUNCTION public.bootstrap_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_all_auth_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_auth_users() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.promote_super_admin(p_email text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_super_admin(p_email text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.demote_super_admin(p_email text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.demote_super_admin(p_email text) TO authenticated;
