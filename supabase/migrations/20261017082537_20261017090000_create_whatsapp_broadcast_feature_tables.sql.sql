-- Saved broadcast presets (Quick Recreate)
CREATE TABLE IF NOT EXISTS wa_broadcast_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  template_name text NOT NULL,
  template_language text DEFAULT 'en_US',
  template_components jsonb DEFAULT '[]',
  variable_mapping jsonb DEFAULT '{}',
  recipient_filter text DEFAULT 'all',
  phone_number_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wa_broadcast_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_presets" ON wa_broadcast_presets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_presets" ON wa_broadcast_presets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_presets" ON wa_broadcast_presets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_presets" ON wa_broadcast_presets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Saved audience segments (Segmentation Builder)
CREATE TABLE IF NOT EXISTS wa_broadcast_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wa_broadcast_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_segments" ON wa_broadcast_segments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_segments" ON wa_broadcast_segments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_segments" ON wa_broadcast_segments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_segments" ON wa_broadcast_segments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Broadcast A/B tests
CREATE TABLE IF NOT EXISTS wa_broadcast_ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  variant_a_template text NOT NULL,
  variant_b_template text NOT NULL,
  split_percentage int DEFAULT 50,
  recipient_filter text DEFAULT 'all',
  campaign_a_id text,
  campaign_b_id text,
  status text DEFAULT 'draft',
  winner text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wa_broadcast_ab_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_abtests" ON wa_broadcast_ab_tests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_abtests" ON wa_broadcast_ab_tests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_abtests" ON wa_broadcast_ab_tests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_abtests" ON wa_broadcast_ab_tests FOR DELETE TO authenticated USING (auth.uid() = user_id);
