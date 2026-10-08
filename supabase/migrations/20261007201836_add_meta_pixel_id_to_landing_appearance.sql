/*
# Add Meta Pixel ID to landing page appearance

## Purpose
The landing page currently has no Meta Pixel tracking. This adds a `meta_pixel_id`
column to the `landing_page_appearance` table so the admin can configure their
Meta Pixel ID. The landing page will load the pixel, fire a PageView on load,
and fire a Lead event when a visitor submits the signup form or popup form.

## Changes
1. `landing_page_appearance` table:
   - Added `meta_pixel_id` column (text, nullable)

## Security
- No RLS policy changes. The existing public-read policy on
  `landing_page_appearance` allows the landing page to fetch the pixel ID
  without authentication, which is the intended behavior for a public landing page.
*/

ALTER TABLE landing_page_appearance
  ADD COLUMN IF NOT EXISTS meta_pixel_id text;
