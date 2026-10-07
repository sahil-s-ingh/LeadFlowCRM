/*
# Change border_width from integer to numeric

## Purpose
The appearance settings use 1.5px as the default border width, but the column was created as integer.
Change it to numeric(4,1) so decimal values like 1.5 can be stored.

## Changes
- appearance_settings.border_width: integer → numeric(4,1)
- Updated default from 1 to 1.5
*/

ALTER TABLE appearance_settings
  ALTER COLUMN border_width TYPE numeric(4,1) USING border_width::numeric(4,1);

ALTER TABLE appearance_settings
  ALTER COLUMN border_width SET DEFAULT 1.5;

ALTER TABLE appearance_settings
  DROP CONSTRAINT IF EXISTS appearance_settings_border_width_check;

ALTER TABLE appearance_settings
  ADD CONSTRAINT appearance_settings_border_width_check CHECK (border_width >= 0 AND border_width <= 10);
