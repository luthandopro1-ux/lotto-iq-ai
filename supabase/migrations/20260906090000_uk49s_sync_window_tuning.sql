-- ------------------------------------------------------------------
-- Automatic sync window tuning
--
-- Before: an external scheduler hit /api/public/hooks/uk49s-sync every
-- 15 minutes, 24 hours a day (96 calls/day, ~92 of them wasted, since
-- UK49s only draws four times a day).
--
-- After: pg_cron ticks every 20 seconds, all day, but a cheap guard
-- function makes every tick outside a real draw window a no-op —
-- so the sync endpoint (and the upstream provider it calls) is only
-- actually hit in four short windows a day, tight around the real
-- draw times. A once-an-hour catch-up call is kept as a safety net for
-- a missed window (deploy blip, provider hiccup, DST edge case).
--
-- Draw times are evaluated in genuine Europe/London local time via
-- Postgres's own timezone database, so BST/GMT is handled correctly
-- with no manual season logic.
-- ------------------------------------------------------------------

create or replace function public.uk49s_in_sync_window(lead_minutes int default 2, tail_minutes int default 6)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from (values ('10:49'::time), ('12:49'::time), ('16:49'::time), ('17:49'::time)) as t(draw_time)
    where (now() at time zone 'Europe/London')::time
      between (draw_time - make_interval(mins => lead_minutes))
          and (draw_time + make_interval(mins => tail_minutes))
  );
$$;

comment on function public.uk49s_in_sync_window(int, int) is
  'True only within a short window (default -2/+6 min) around one of the four UK49s draw times, in real Europe/London local time.';

create or replace function public.uk49s_sync_tick()
returns void
language plpgsql
as $$
declare
  project_url text;
  sync_secret text;
begin
  if not public.uk49s_in_sync_window() then
    return;
  end if;

  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'uk49s_project_url';
  select decrypted_secret into sync_secret from vault.decrypted_secrets where name = 'uk49s_sync_secret';

  if project_url is null or sync_secret is null then
    -- Not configured yet — see the setup note below. No-op rather than error,
    -- so this migration applies cleanly before the secrets exist.
    return;
  end if;

  perform net.http_post(
    url := project_url || '/api/public/hooks/uk49s-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', sync_secret),
    body := '{}'::jsonb
  );
end;
$$;

comment on function public.uk49s_sync_tick() is
  'Guarded sync call — only actually posts to uk49s-sync when uk49s_in_sync_window() is true.';

-- Ticks every 20 seconds, all day. Outside the four draw windows this is a
-- single cheap timestamp check with no network call.
select cron.schedule('uk49s-sync-tick', '20 seconds', $$select public.uk49s_sync_tick();$$);

-- Hourly safety net: one coarse catch-up call, replacing the old
-- "every 15 minutes around the clock" cadence with a single low-cost
-- background check in case a draw-window tick was missed entirely.
select cron.schedule(
  'uk49s-sync-hourly-catchup',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'uk49s_project_url') || '/api/public/hooks/uk49s-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'uk49s_sync_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'uk49s_project_url');
  $$
);

-- ------------------------------------------------------------------
-- One-time setup (run once in the Supabase SQL editor — NOT committed
-- to git, since it embeds your project URL and a secret):
--
--   select vault.create_secret('https://<your-project-ref>.supabase.co', 'uk49s_project_url');
--   select vault.create_secret('<a long random string, matching SYNC_WEBHOOK_SECRET below>', 'uk49s_sync_secret');
--
-- Generate the secret with, e.g.: openssl rand -hex 32
--
-- Then set the SAME value as a Cloudflare secret on the deployed Worker,
-- so the uk49s-sync route accepts it:
--   npx wrangler secret put SYNC_WEBHOOK_SECRET --config .output/server/wrangler.json
--
-- Until uk49s_project_url and uk49s_sync_secret both exist, uk49s_sync_tick()
-- and the hourly catch-up both no-op safely — nothing breaks, sync just
-- stays off.
--
-- Also remember to remove/disable whatever external scheduler (cron-job.org,
-- a hosting platform's cron, etc.) was previously calling uk49s-sync every
-- 15 minutes — leaving both running would double up sync calls.
-- ------------------------------------------------------------------
