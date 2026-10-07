-- Enable realtime for email_log table so the analytics dashboard auto-refreshes on open/click events
ALTER PUBLICATION supabase_realtime ADD TABLE email_log;
