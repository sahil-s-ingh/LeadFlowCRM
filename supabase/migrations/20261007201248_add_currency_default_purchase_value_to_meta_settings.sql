/*
# Add currency and default_purchase_value to Meta Conversion API settings

## Purpose
Meta (Facebook) rejects Purchase events that are missing the `value` and `currency`
parameters. Currently the edge function only sends those when a lead has a fund
amount or purchase value, and the currency is hardcoded to "USD". This migration
adds two new columns so the admin can configure:
- `currency` — the ISO 4217 currency code to send with Purchase events (default USD)
- `default_purchase_value` — a fallback numeric value sent when a converted lead
  has no fund amount or purchase value set, so Meta always receives a valid value

## Changes
1. `meta_conversion_settings` table:
   - Added `currency` column (text, NOT NULL, default 'USD')
   - Added `default_purchase_value` column (numeric, nullable)

## Security
- No RLS policy changes. Existing owner-scoped policies on
  `meta_conversion_settings` remain unchanged and continue to protect the data.
*/

ALTER TABLE meta_conversion_settings
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

ALTER TABLE meta_conversion_settings
  ADD COLUMN IF NOT EXISTS default_purchase_value numeric;
