/*
# Add soft delete columns to submissions table

## Purpose
Instead of permanently deleting leads, marks them as deleted with a timestamp.
This enables a "Recycle Bin" where leads can be restored within 30 days.

## Changes to existing table: submissions
- deleted_at (timestamptz, nullable) — when the lead was soft-deleted; NULL means active
- deleted_by (uuid, nullable) — the user who deleted the lead (references auth.users)

## RLS impact
- No policy changes needed. Existing CRUD policies already cover UPDATE operations.
- The frontend will filter out soft-deleted leads (deleted_at IS NOT NULL) from the main list
  and show them in a separate Recycle Bin tab.
*/

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_deleted_at ON submissions(deleted_at) WHERE deleted_at IS NOT NULL;
