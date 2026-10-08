/*
# Fix Data Isolation: Prevent Cross-Customer Data Leakage

## Purpose
Currently, the submissions (leads) table and several other tables have RLS
policies with `USING(true)`, meaning ANY logged-in CRM user can see, edit,
and delete ALL data from ALL customers. This is a critical security flaw.
This migration fixes it so each CRM user only sees their own data.

## Changes

### 1. Add user_id columns to tables missing them
- `meta_conversion_log` — add `user_id uuid` (nullable, references auth.users)
- `wa_call_permissions` — add `user_id uuid` (nullable, references auth.users)
- `ib_leads` — add `user_id uuid` (nullable, references auth.users)

### 2. Add user_id default to submissions for authenticated inserts
- `submissions.user_id` already exists but is nullable with no default.
  Add `DEFAULT auth.uid()` so authenticated inserts auto-populate the owner.

### 3. Replace weak RLS policies with proper ownership checks

**submissions (leads):**
- Replace `USING(true)` admin policies with `auth.uid() = user_id` ownership.
- Keep anon INSERT for public form submissions (landing page visitors).
- Add a new `anon_select_submissions` policy for the public activity feed
  (limited to full_name and state only via a SECURITY DEFINER function instead).

**wa_call_recordings:**
- Scope through wa_call_sessions: only the call session owner can access.

**wa_call_permissions:**
- Add ownership check on new user_id column.

**meta_conversion_log:**
- Add ownership check on new user_id column.

**ib_leads:**
- Add ownership check on new user_id column.

### 4. Create get_public_recent_activity() function
- SECURITY DEFINER function that returns only full_name and state from
  recent submissions, for the landing page activity feed. This avoids
  exposing the full table to the anon role.

### 5. Assign existing null-user_id submissions to the platform owner
- Existing 532 leads have user_id = NULL. Assign them all to the first
  super admin so they aren't orphaned.

## Security
- All authenticated SELECT/UPDATE/DELETE policies now use `auth.uid() = user_id`
  or equivalent ownership checks through parent tables.
- Public (anon) INSERT remains for form submissions, but SELECT is now
  restricted to a safe RPC that only exposes names and states.
*/

-- === 1. Add user_id columns where missing ===
ALTER TABLE meta_conversion_log ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE wa_call_permissions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ib_leads ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- === 2. Add default auth.uid() to submissions.user_id for authenticated inserts ===
ALTER TABLE submissions ALTER COLUMN user_id SET DEFAULT auth.uid();

-- === 3. Assign existing null submissions to the first super admin ===
UPDATE submissions SET user_id = (SELECT id FROM super_admins ORDER BY created_at LIMIT 1)
WHERE user_id IS NULL;

-- === 4. Fix submissions RLS policies ===
DROP POLICY IF EXISTS "admin_select_submissions" ON submissions;
DROP POLICY IF EXISTS "admin_update_submissions" ON submissions;
DROP POLICY IF EXISTS "admin_delete_submissions" ON submissions;
DROP POLICY IF EXISTS "anon_insert_submissions" ON submissions;

CREATE POLICY "select_own_submissions"
ON submissions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "insert_own_submissions"
ON submissions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_submissions"
ON submissions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_submissions"
ON submissions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Keep anon INSERT for public form submissions (landing page + popup forms)
CREATE POLICY "anon_insert_submissions"
ON submissions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- === 5. Fix wa_call_recordings RLS (scope through wa_call_sessions) ===
DROP POLICY IF EXISTS "select_wa_call_recordings" ON wa_call_recordings;
DROP POLICY IF EXISTS "insert_wa_call_recordings" ON wa_call_recordings;
DROP POLICY IF EXISTS "update_wa_call_recordings" ON wa_call_recordings;
DROP POLICY IF EXISTS "delete_wa_call_recordings" ON wa_call_recordings;

CREATE POLICY "select_own_wa_call_recordings"
ON wa_call_recordings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM wa_call_sessions
    WHERE wa_call_sessions.id = wa_call_recordings.call_session_id
    AND wa_call_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "insert_own_wa_call_recordings"
ON wa_call_recordings FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM wa_call_sessions
    WHERE wa_call_sessions.id = wa_call_recordings.call_session_id
    AND wa_call_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "update_own_wa_call_recordings"
ON wa_call_recordings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM wa_call_sessions
    WHERE wa_call_sessions.id = wa_call_recordings.call_session_id
    AND wa_call_sessions.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM wa_call_sessions
    WHERE wa_call_sessions.id = wa_call_recordings.call_session_id
    AND wa_call_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "delete_own_wa_call_recordings"
ON wa_call_recordings FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM wa_call_sessions
    WHERE wa_call_sessions.id = wa_call_recordings.call_session_id
    AND wa_call_sessions.user_id = auth.uid()
  )
);

-- === 6. Fix wa_call_permissions RLS ===
DROP POLICY IF EXISTS "select_own_wa_call_permissions" ON wa_call_permissions;
DROP POLICY IF EXISTS "insert_own_wa_call_permissions" ON wa_call_permissions;
DROP POLICY IF EXISTS "update_own_wa_call_permissions" ON wa_call_permissions;
DROP POLICY IF EXISTS "delete_own_wa_call_permissions" ON wa_call_permissions;

CREATE POLICY "select_own_wa_call_permissions"
ON wa_call_permissions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "insert_own_wa_call_permissions"
ON wa_call_permissions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_wa_call_permissions"
ON wa_call_permissions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_wa_call_permissions"
ON wa_call_permissions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- === 7. Fix meta_conversion_log RLS ===
DROP POLICY IF EXISTS "select_own_meta_log" ON meta_conversion_log;
DROP POLICY IF EXISTS "insert_own_meta_log" ON meta_conversion_log;
DROP POLICY IF EXISTS "update_own_meta_log" ON meta_conversion_log;
DROP POLICY IF EXISTS "delete_own_meta_log" ON meta_conversion_log;

CREATE POLICY "select_own_meta_log"
ON meta_conversion_log FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "insert_own_meta_log"
ON meta_conversion_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_meta_log"
ON meta_conversion_log FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_meta_log"
ON meta_conversion_log FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- === 8. Fix ib_leads RLS ===
DROP POLICY IF EXISTS "authenticated_select_ib_leads" ON ib_leads;
DROP POLICY IF EXISTS "authenticated_update_ib_leads" ON ib_leads;
DROP POLICY IF EXISTS "authenticated_delete_ib_leads" ON ib_leads;
DROP POLICY IF EXISTS "anon_insert_ib_leads" ON ib_leads;

CREATE POLICY "select_own_ib_leads"
ON ib_leads FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "insert_own_ib_leads"
ON ib_leads FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_ib_leads"
ON ib_leads FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_ib_leads"
ON ib_leads FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Keep anon INSERT for public IB applications
CREATE POLICY "anon_insert_ib_leads"
ON ib_leads FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- === 9. Create safe public activity feed function ===
CREATE OR REPLACE FUNCTION public.get_public_recent_activity()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(
    json_build_object(
      'full_name', s.full_name,
      'state', s.state,
      'created_at', s.created_at
    )
    ORDER BY s.created_at DESC
  ), '[]'::json)
  FROM (
    SELECT full_name, state, created_at
    FROM public.submissions
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 8
  ) s;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_recent_activity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_recent_activity() TO anon, authenticated;
