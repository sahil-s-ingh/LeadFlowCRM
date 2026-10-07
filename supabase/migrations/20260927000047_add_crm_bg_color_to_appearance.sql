/*
# Add CRM background color to appearance settings

## Purpose
Allow the owner to customize the background color of the CRM dashboard page.

## Changes to existing table: appearance_settings
- crm_bg_color (text, default '#f1f5f9') — background color applied to the CRM page only

## RLS impact
- No policy changes needed. Existing CRUD policies already cover UPDATE/INSERT.
*/

ALTER TABLE appearance_settings ADD COLUMN IF NOT EXISTS crm_bg_color text DEFAULT '#f1f5f9';
