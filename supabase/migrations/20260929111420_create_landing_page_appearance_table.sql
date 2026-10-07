/*
# Create landing_page_appearance table

## Overview
Stores the color palette for the public landing page. One row per user (the CRM owner).
The landing page reads this publicly so visitors see the customized colors.

## Table: landing_page_appearance
- id (uuid PK)
- user_id (uuid, owner, defaults to auth.uid())
- primary_color (text, the seed color)
- palette_style (text: vibrant | muted | monochrome)
- enabled (boolean, default false — when false, landing page uses hardcoded defaults)
- 18 color columns matching LandingPalette interface
- created_at, updated_at (timestamptz)

## RLS
- SELECT: public (anyone, including anon) so the landing page can load colors for visitors
- INSERT/UPDATE/DELETE: owner only (auth.uid() = user_id)
*/

CREATE TABLE IF NOT EXISTS landing_page_appearance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  primary_color text NOT NULL DEFAULT '#EAB308',
  palette_style text NOT NULL DEFAULT 'vibrant',
  enabled boolean NOT NULL DEFAULT false,
  primary_light text,
  primary_dark text,
  accent text,
  accent_dark text,
  background text,
  surface text,
  surface_tint text,
  text text,
  text_muted text,
  border text,
  button_bg text,
  button_text text,
  button_hover text,
  badge_bg text,
  badge_text text,
  footer_bg text,
  footer_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE landing_page_appearance ENABLE ROW LEVEL SECURITY;

-- Public SELECT so the landing page (anon visitor) can read the active palette
DROP POLICY IF EXISTS "public_select_landing_appearance" ON landing_page_appearance;
CREATE POLICY "public_select_landing_appearance"
ON landing_page_appearance FOR SELECT
TO anon, authenticated
USING (true);

-- Owner-only INSERT
DROP POLICY IF EXISTS "insert_own_landing_appearance" ON landing_page_appearance;
CREATE POLICY "insert_own_landing_appearance"
ON landing_page_appearance FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Owner-only UPDATE
DROP POLICY IF EXISTS "update_own_landing_appearance" ON landing_page_appearance;
CREATE POLICY "update_own_landing_appearance"
ON landing_page_appearance FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Owner-only DELETE
DROP POLICY IF EXISTS "delete_own_landing_appearance" ON landing_page_appearance;
CREATE POLICY "delete_own_landing_appearance"
ON landing_page_appearance FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
