-- Change follow-up reminder cron from every 5 minutes to every 1 minute
SELECT cron.alter_job(
  job_id => (SELECT jobid FROM cron.job WHERE jobname = 'process-follow-up-reminders'),
  schedule => '* * * * *'
);