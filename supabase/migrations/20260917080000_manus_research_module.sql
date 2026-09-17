-- ------------------------------------------------------------------
-- Manus AI research module
--
-- A weekly background job that asks Manus (an autonomous research
-- agent, api.manus.ai) to (a) research current public lottery-number
-- pattern/strategy techniques and (b) compare them against this app's
-- own actual backtest performance (pulled fresh from `backtests` and
-- `lottery_backtests` each run). Manus tasks are asynchronous — this
-- table tracks the request/response lifecycle via Manus's webhook.
-- ------------------------------------------------------------------

CREATE TABLE public.research_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manus_task_id text UNIQUE,
  manus_task_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  prompt text NOT NULL,
  our_model_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  findings jsonb,
  raw_message text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX research_reports_created_idx ON public.research_reports (created_at DESC);
GRANT SELECT ON public.research_reports TO anon, authenticated;
GRANT ALL ON public.research_reports TO service_role;
ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "research_reports are readable" ON public.research_reports FOR SELECT USING (true);

-- Weekly trigger: Monday 06:00 UTC. Guarded the same way as the UK49
-- sync tick — no-ops safely until the two Vault secrets below exist.
CREATE OR REPLACE FUNCTION public.research_weekly_tick()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  project_url text;
  research_secret text;
BEGIN
  SELECT decrypted_secret INTO project_url FROM vault.decrypted_secrets WHERE name = 'research_project_url';
  SELECT decrypted_secret INTO research_secret FROM vault.decrypted_secrets WHERE name = 'research_webhook_secret';

  IF project_url IS NULL OR research_secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := project_url || '/api/public/hooks/research-weekly',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-research-secret', research_secret),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule('research-weekly', '0 6 * * 1', $$SELECT public.research_weekly_tick();$$);

-- ------------------------------------------------------------------
-- One-time setup (Supabase SQL editor, not committed to git):
--
--   select vault.create_secret('https://<your-deployed-url>', 'research_project_url');
--   select vault.create_secret('<a long random string>', 'research_webhook_secret');
--
-- Also set on Cloudflare (matching the second value above):
--   RESEARCH_WEBHOOK_SECRET
--   MANUS_API_KEY   (from https://manus.im/app?show_settings=integrations&app_name=api)
--
-- And register the Manus webhook ONCE (not automatable — Manus's API
-- isn't reachable from a Supabase/Cloudflare function during setup,
-- this is a one-off call you make yourself after deploying):
--
--   curl -X POST https://api.manus.ai/v2/webhook.create \
--     -H "Content-Type: application/json" \
--     -H "x-manus-api-key: $MANUS_API_KEY" \
--     -d '{"url":"https://<your-deployed-url>/api/public/hooks/manus-webhook","events":["task_stopped"]}'
-- ------------------------------------------------------------------
