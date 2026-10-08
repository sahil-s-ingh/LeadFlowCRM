/*
# Super Admin Profile Fields

## Purpose
Adds profile columns to super_admins so the platform owner can store
their name, phone, address, company info, and avatar URL.

## New Columns on super_admins
- full_name (text, nullable)
- phone (text, nullable)
- company_name (text, nullable)
- address_line1 (text, nullable)
- address_line2 (text, nullable)
- city (text, nullable)
- state (text, nullable)
- postal_code (text, nullable)
- country (text, nullable)
- avatar_url (text, nullable)
- bio (text, nullable)
- updated_at (timestamptz, default now())
*/

ALTER TABLE super_admins
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Allow super admins to update their own profile
DROP POLICY IF EXISTS "super_admins_self_update" ON super_admins;
CREATE POLICY "super_admins_self_update"
ON super_admins FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
