-- Add recording/transcription settings and call metadata to wa_call_sessions
ALTER TABLE wa_call_sessions
  ADD COLUMN IF NOT EXISTS recording_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS transcription_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_duration integer,
  ADD COLUMN IF NOT EXISTS call_start_time timestamptz,
  ADD COLUMN IF NOT EXISTS call_end_time timestamptz,
  ADD COLUMN IF NOT EXISTS biz_opaque_callback_data text,
  ADD COLUMN IF NOT EXISTS error_code integer,
  ADD COLUMN IF NOT EXISTS error_message text;

-- Create table for call recordings and transcripts
CREATE TABLE IF NOT EXISTS wa_call_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid REFERENCES wa_call_sessions(id) ON DELETE CASCADE,
  call_id text,
  type text NOT NULL DEFAULT 'recording',
  media_id text,
  sha256 text,
  mime_type text,
  download_url text,
  downloaded boolean DEFAULT false,
  local_file_path text,
  transcript_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wa_call_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_wa_call_recordings" ON wa_call_recordings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_wa_call_recordings" ON wa_call_recordings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_wa_call_recordings" ON wa_call_recordings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_wa_call_recordings" ON wa_call_recordings FOR DELETE
  TO authenticated USING (true);

-- Enable realtime for recordings table
ALTER TABLE wa_call_recordings REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'wa_call_recordings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE wa_call_recordings;
  END IF;
END $$;
