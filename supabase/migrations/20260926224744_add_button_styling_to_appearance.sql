/*
# Add button styling columns to appearance_settings

## Purpose
Extend appearance settings to also control button styling in the CRM:
button background color, text color, and button border color/width/radius.

## Changes
- Add btn_bg_color (text, DEFAULT '#0F172A')
- Add btn_text_color (text, DEFAULT '#FFFFFF')
- Add btn_border_color (text, DEFAULT '#EAB308')
- Add btn_border_width (numeric(4,1), DEFAULT 0)
- Add btn_border_radius (integer, DEFAULT 10)
*/

ALTER TABLE appearance_settings
  ADD COLUMN IF NOT EXISTS btn_bg_color text NOT NULL DEFAULT '#0F172A';

ALTER TABLE appearance_settings
  ADD COLUMN IF NOT EXISTS btn_text_color text NOT NULL DEFAULT '#FFFFFF';

ALTER TABLE appearance_settings
  ADD COLUMN IF NOT EXISTS btn_border_color text NOT NULL DEFAULT '#EAB308';

ALTER TABLE appearance_settings
  ADD COLUMN IF NOT EXISTS btn_border_width numeric(4,1) NOT NULL DEFAULT 0 CHECK (btn_border_width >= 0 AND btn_border_width <= 10);

ALTER TABLE appearance_settings
  ADD COLUMN IF NOT EXISTS btn_border_radius integer NOT NULL DEFAULT 10 CHECK (btn_border_radius >= 0 AND btn_border_radius <= 32);
