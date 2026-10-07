/*
# Allow authenticated admin to read leads (submissions)

1. Purpose
- The CRM admin dashboard requires reading the `submissions` table after login.
- Currently only an INSERT policy exists for public form submissions.
- This adds a SELECT policy scoped to authenticated users (admin who signed in).

2. Security
- `submissions` already has RLS enabled.
- New policy: `admin_select_submissions` — SELECT for `authenticated` role only.
- Anon (public landing page) remains INSERT-only — cannot read leads.
- No UPDATE or DELETE policies added — admin views leads but cannot modify them from the dashboard (read-only CRM view).
*/

DROP POLICY IF EXISTS "admin_select_submissions" ON submissions;
CREATE POLICY "admin_select_submissions"
ON submissions FOR SELECT
TO authenticated
USING (true);