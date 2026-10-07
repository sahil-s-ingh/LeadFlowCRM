/*
# Add Advanced Features to Popup Form Builder

## Purpose
Extends the popup_forms table with new columns to support:
- Radio button field type (single-choice from options)
- Date field type (date picker)
- URL/website field type
- Field default values (pre-fill fields)
- Field width control (full vs half width)
- Custom success message per form
- Show popup once per visitor (persistent, not just per session)
- Background overlay color customization
- Popup position (center, bottom-left, bottom-right)
- Auto-close after submission with configurable delay
- Form description/help text under subtitle
- Image/logo URL at top of popup

## Modified Tables

### popup_forms
Added columns:
- success_message (text) — custom message shown after submission
- show_once (boolean) — if true, use localStorage instead of sessionStorage
- overlay_color (text) — hex color for the background overlay
- popup_position (text) — center|bottom_left|bottom_right
- auto_close_delay (int) — seconds to wait before auto-closing after submission (0 = no auto-close)
- description (text) — help text shown under subtitle
- image_url (text) — optional image/logo URL shown at top of popup

### fields jsonb structure
Each field object can now include:
- default_value (string) — pre-fill value
- width (string) — "full" or "half"
New type values: "radio", "date", "url"

## Security
- No RLS changes needed — existing policies already cover these columns.

## Important Notes
1. All new columns are nullable or have defaults so existing forms continue to work.
2. The fields jsonb already accepts arbitrary structure, so no migration needed for field-level changes.
3. Existing forms without these columns will use sensible defaults in the frontend.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'popup_forms' AND column_name = 'success_message') THEN
    ALTER TABLE popup_forms ADD COLUMN success_message text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'popup_forms' AND column_name = 'show_once') THEN
    ALTER TABLE popup_forms ADD COLUMN show_once boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'popup_forms' AND column_name = 'overlay_color') THEN
    ALTER TABLE popup_forms ADD COLUMN overlay_color text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'popup_forms' AND column_name = 'popup_position') THEN
    ALTER TABLE popup_forms ADD COLUMN popup_position text NOT NULL DEFAULT 'center';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'popup_forms' AND column_name = 'auto_close_delay') THEN
    ALTER TABLE popup_forms ADD COLUMN auto_close_delay int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'popup_forms' AND column_name = 'description') THEN
    ALTER TABLE popup_forms ADD COLUMN description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'popup_forms' AND column_name = 'image_url') THEN
    ALTER TABLE popup_forms ADD COLUMN image_url text;
  END IF;
END $$;
