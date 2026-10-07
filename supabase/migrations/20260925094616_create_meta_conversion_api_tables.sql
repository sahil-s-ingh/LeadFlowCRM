-- Meta Conversion API settings table
CREATE TABLE meta_conversion_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pixel_id text NOT NULL,
  access_token text NOT NULL,
  api_version text NOT NULL DEFAULT 'v18.0',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meta_conversion_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_meta_settings" ON meta_conversion_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_meta_settings" ON meta_conversion_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_meta_settings" ON meta_conversion_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_meta_settings" ON meta_conversion_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Meta conversion log table
CREATE TABLE meta_conversion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  event_name text NOT NULL,
  event_time timestamptz NOT NULL DEFAULT now(),
  status text,
  fund_amount numeric,
  meta_response jsonb,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meta_conversion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_meta_log" ON meta_conversion_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_own_meta_log" ON meta_conversion_log
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_own_meta_log" ON meta_conversion_log
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_own_meta_log" ON meta_conversion_log
  FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_meta_conversion_log_lead_id ON meta_conversion_log(lead_id);
CREATE INDEX idx_meta_conversion_settings_user ON meta_conversion_settings(user_id);

-- Add meta_conversion_sent_at to submissions if not exists
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS meta_conversion_sent_at timestamptz;
