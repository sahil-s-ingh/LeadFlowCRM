/*
# Add sidebar color, font size, and dark mode to appearance settings

## Purpose
Allow the owner to customize the sidebar background color, overall font size, and toggle dark mode for the CRM dashboard.

## Changes to existing table: appearance_settings
- sidebar_color (text, default '#FFFFFF') — background color of the CRM sidebar
- font_size (text, default 'medium') — controls overall text size: 'small', 'medium', or 'large'
- dark_mode (boolean, default false) — toggles a dark theme across the CRM page

## RLS impact
- No policy changes needed. Existing CRUD policies already cover UPDATE/INSERT.
*/

ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS sidebar_color text DEFAULT '#FFFFFF';
ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS font_size text DEFAULT 'medium';
ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS dark_mode boolean DEFAULT false;
