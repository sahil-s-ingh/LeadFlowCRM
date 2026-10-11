/*
# Create brokers table and add broker_id to submissions

1. New Tables
- `brokers` — stores broker configurations (name, website, logo URL, sort order)
  - `id` (uuid, primary key)
  - `user_id` (uuid, owner — defaults to auth.uid())
  - `name` (text, not null) — broker display name
  - `website` (text, nullable) — broker website URL
  - `logo_url` (text, nullable) — optional logo image URL
  - `sort_order` (int, default 0) — for custom ordering
  - `is_active` (boolean, default true) — soft-disable brokers
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Modified Tables
- `submissions` — add `broker_id` (uuid, nullable) referencing brokers(id) with ON DELETE SET NULL.
  This links a lead to the broker they have (or will have) an account with.

3. Security
- Enable RLS on `brokers`.
- Owner-scoped CRUD: each authenticated user can only manage their own brokers.
- Submissions already has RLS enabled; the new broker_id column inherits the existing policies.
*/

CREATE TABLE IF NOT EXISTS brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  website text,
  logo_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_brokers" ON brokers;
CREATE POLICY "select_own_brokers" ON brokers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_brokers" ON brokers;
CREATE POLICY "insert_own_brokers" ON brokers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_brokers" ON brokers;
CREATE POLICY "update_own_brokers" ON brokers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_brokers" ON brokers;
CREATE POLICY "delete_own_brokers" ON brokers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Add broker_id column to submissions (nullable, no data loss)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'broker_id'
  ) THEN
    ALTER TABLE submissions ADD COLUMN broker_id uuid;
  END IF;
END $$;

-- Add foreign key constraint (drop first for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'submissions_broker_id_fkey'
  ) THEN
    ALTER TABLE submissions
    ADD CONSTRAINT submissions_broker_id_fkey
    FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_brokers_user_id ON brokers(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_broker_id ON submissions(broker_id);
