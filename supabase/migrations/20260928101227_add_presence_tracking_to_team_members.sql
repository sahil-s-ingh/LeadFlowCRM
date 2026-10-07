/*
# Add presence tracking columns to team_members

1. Purpose
- Track which team members are currently online (last_seen_at) and when they last logged in (last_login_at).
- Enables the Team Dashboard to show online/offline status and last login times.

2. Changes to existing tables
- `team_members`
  - `last_seen_at` (timestamptz, nullable) — updated every ~2 minutes by a heartbeat while the member is active in the CRM. If within the last 5 minutes, the member is considered "online".
  - `last_login_at` (timestamptz, nullable) — set once when the member's session starts.

3. Security
- RLS on team_members only allows the owner to UPDATE. Team members cannot update their own row directly.
- A SECURITY DEFINER function `update_my_presence()` is created so a member can update only their own last_seen_at by matching their auth email to team_members.email.
- The function is granted to authenticated and is safe: it only touches the caller's own row.
*/

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_team_members_last_seen ON team_members(last_seen_at);

-- SECURITY DEFINER function: lets a team member update their own presence
-- without needing owner-level UPDATE RLS on team_members.
CREATE OR REPLACE FUNCTION update_my_presence(p_last_login boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RETURN;
  END IF;

  IF p_last_login THEN
    UPDATE team_members
    SET last_seen_at = now(),
        last_login_at = now()
    WHERE email = v_email;
  ELSE
    UPDATE team_members
    SET last_seen_at = now()
    WHERE email = v_email;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_my_presence(boolean) TO authenticated;