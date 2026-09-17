SELECT cron.schedule(
  'russia-sync-hourly',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'uk49s_project_url') || '/api/public/hooks/russia-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'uk49s_sync_secret')
    ),
    body := '{}'::jsonb
  )
  WHERE EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'uk49s_project_url' AND decrypted_secret IS NOT NULL
  )
  AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'uk49s_sync_secret' AND decrypted_secret IS NOT NULL
  );
  $$
);
