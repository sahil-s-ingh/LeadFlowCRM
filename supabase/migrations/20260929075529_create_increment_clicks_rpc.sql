/*
# Create increment_clicks RPC function

1. Functions
- `increment_clicks(link_code text)` — increments the clicks counter for a short link by its short_code
- SECURITY DEFINER so it can update the clicks column even when called by anon role (during redirect)
- Returns void
*/

CREATE OR REPLACE FUNCTION increment_clicks(link_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE short_links SET clicks = clicks + 1 WHERE short_code = link_code;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_clicks(text) TO anon, authenticated;
