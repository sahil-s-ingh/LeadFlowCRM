-- Add fields for welcome email enhancements
ALTER TABLE follow_up_settings
  ADD COLUMN IF NOT EXISTS welcome_urgency_hours INT DEFAULT 24,
  ADD COLUMN IF NOT EXISTS welcome_next_steps TEXT,
  ADD COLUMN IF NOT EXISTS welcome_booking_link TEXT,
  ADD COLUMN IF NOT EXISTS welcome_testimonial TEXT,
  ADD COLUMN IF NOT EXISTS welcome_testimonial_author TEXT,
  ADD COLUMN IF NOT EXISTS welcome_reply_tracking BOOLEAN DEFAULT false;

-- Add lead_activities type for email replies (if not exists)
-- Used to track when a lead replies to the welcome email
