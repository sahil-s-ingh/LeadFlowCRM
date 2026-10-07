/*
# Allow authenticated admin to delete leads

1. Purpose
- Admin needs to remove leads from the CRM dashboard (spam, duplicates, test entries, etc.)

2. Security
- Add DELETE policy for authenticated admin only.
- Anon (public landing page) cannot delete — only the signed-in admin can.
- Existing INSERT (anon), SELECT (authenticated), and UPDATE (authenticated) policies remain unchanged.
*/

DROP POLICY IF EXISTS "admin_delete_submissions" ON submissions;
CREATE POLICY "admin_delete_submissions"
ON submissions FOR DELETE
TO authenticated
USING (true);