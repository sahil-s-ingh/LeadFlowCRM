/*
# Add lead management columns to submissions

1. Purpose
- Transform the submissions table into a full CRM lead pipeline.
- Admin needs to track call outcomes, interest level, custom tags, and notes per lead.

2. New Columns on `submissions`
- `status` (text, default 'new') — pipeline stage: new, called_no_response, called_responded, interested, not_interested, converted
- `tags` (text[], default '{}') — dynamic custom tags (e.g. "hot lead", "callback", "whatsapp sent")
- `notes` (text, default '') — admin call notes / interaction log
- `last_contacted_at` (timestamptz, nullable) — when the admin last contacted this lead

3. Security
- Add UPDATE policy for authenticated admin to modify status, tags, notes, last_contacted_at.
- Existing INSERT (anon) and SELECT (authenticated) policies remain unchanged.
- No DELETE policy — leads are never deleted from the dashboard.

4. Notes
- All new columns have safe defaults so existing rows are not affected.
- The status CHECK constraint enforces valid pipeline stages only.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'status') THEN
    ALTER TABLE submissions ADD COLUMN status text NOT NULL DEFAULT 'new';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'tags') THEN
    ALTER TABLE submissions ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'notes') THEN
    ALTER TABLE submissions ADD COLUMN notes text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'last_contacted_at') THEN
    ALTER TABLE submissions ADD COLUMN last_contacted_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_status_check') THEN
    ALTER TABLE submissions ADD CONSTRAINT submissions_status_check
    CHECK (status IN ('new', 'called_no_response', 'called_responded', 'interested', 'not_interested', 'converted'));
  END IF;
END $$;

DROP POLICY IF EXISTS "admin_update_submissions" ON submissions;
CREATE POLICY "admin_update_submissions"
ON submissions FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);