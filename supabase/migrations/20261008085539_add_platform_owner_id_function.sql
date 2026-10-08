/*
# Add public function to get platform owner ID

## Purpose
The landing page form is submitted by anonymous visitors (no auth session).
The form needs to assign the lead to the platform owner (first super admin).
But the super_admins table is protected by RLS — only authenticated users
can read their own row. This function safely exposes just the owner's UUID
to the anon role so leads can be assigned on insert.

## Changes
- Create get_platform_owner_id() SECURITY DEFINER function
- Grant execute to anon and authenticated
*/

CREATE OR REPLACE FUNCTION public.get_platform_owner_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM super_admins ORDER BY created_at LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_platform_owner_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_owner_id() TO anon, authenticated;
