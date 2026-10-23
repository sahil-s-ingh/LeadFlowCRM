/*
# Add Apple Sign In Support to Social Auth Config

## Summary
Adds an `apple_enabled` column to `platform_social_auth_config` so the admin
can toggle an Apple Sign In button on the login page — following the same
pattern already used for Google and Facebook.

## Changes
1. **platform_social_auth_config** (existing table)
   - New column: `apple_enabled` (boolean, default false)
   - This is purely additive; no existing columns are altered.

2. **public_social_auth_flags** (existing view)
   - Recreated to also expose `apple_enabled` alongside `google_enabled` and
     `facebook_enabled`, so the login page can read all three flags in one query.

## Security
- No new tables.
- RLS on `platform_social_auth_config` is unchanged.
- The public view only exposes boolean flags (no secrets), so granting SELECT
  to `anon` and `authenticated` remains safe.
*/

ALTER TABLE platform_social_auth_config
  ADD COLUMN IF NOT EXISTS apple_enabled boolean NOT NULL DEFAULT false;

-- Recreate the public view to include the new flag
DROP VIEW IF EXISTS public.public_social_auth_flags;
CREATE VIEW public.public_social_auth_flags AS
  SELECT google_enabled, facebook_enabled, apple_enabled
  FROM platform_social_auth_config
  WHERE is_active = true
  LIMIT 1;

GRANT SELECT ON public.public_social_auth_flags TO anon, authenticated;
