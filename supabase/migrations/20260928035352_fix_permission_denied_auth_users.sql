/*
# Fix "permission denied for table users" in role_permissions SELECT policy

The `select_own_role_permissions` policy on `role_permissions` subqueries
`auth.users` to look up the current user's email. The `authenticated` role
has no SELECT privilege on `auth.users`, so the policy fails at runtime.

Fix: create a SECURITY DEFINER function `get_current_user_email()` that
returns the current user's email, then rewrite the policy to use it.

1. New function
- `public.get_current_user_email()` — SECURITY DEFINER, returns text
2. Modified policies
- `role_permissions` SELECT — replace auth.users subquery with function call
3. Security
- The function only returns the calling user's own email — no cross-user exposure.
*/

CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_current_user_email() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_email() TO authenticated;

DROP POLICY IF EXISTS "select_own_role_permissions" ON role_permissions;

CREATE POLICY "select_own_role_permissions" ON role_permissions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.owner_id = role_permissions.owner_id
        AND tm.email = public.get_current_user_email()
        AND tm.status = 'active'
    )
  );
