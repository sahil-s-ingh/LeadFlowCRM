CREATE TABLE IF NOT EXISTS wa_call_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text UNIQUE NOT NULL,
  response text NOT NULL DEFAULT 'reject',
  is_permanent boolean NOT NULL DEFAULT false,
  expiration_timestamp timestamptz,
  response_source text NOT NULL DEFAULT 'user_action',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wa_call_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_wa_call_permissions" ON wa_call_permissions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_own_wa_call_permissions" ON wa_call_permissions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_own_wa_call_permissions" ON wa_call_permissions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_own_wa_call_permissions" ON wa_call_permissions FOR DELETE
  TO authenticated USING (true);
