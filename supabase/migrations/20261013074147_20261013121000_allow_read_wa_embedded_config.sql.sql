/*
# Allow authenticated users to read WA embedded signup config

Clients need to read the meta_app_id and config_id to launch the Facebook embedded signup popup.
Only the super-admin can write; all authenticated users can read (the config contains no secrets —
just the app ID and config ID which are public values embedded in the Facebook SDK).
*/

DROP POLICY IF EXISTS "sa_select_wa_embedded_config" ON wa_embedded_signup_config;
CREATE POLICY "auth_select_wa_embedded_config"
  ON wa_embedded_signup_config FOR SELECT
  TO authenticated
  USING (true);
