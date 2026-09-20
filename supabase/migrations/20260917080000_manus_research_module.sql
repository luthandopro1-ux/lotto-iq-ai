-- ------------------------------------------------------------------
-- Manus AI research module
--
-- A background job (Monday/Wednesday/Friday, triggered natively by
-- the Cloudflare Worker — see nitro.config.ts and tasks/research-tick.ts,
-- not by pg_cron) that asks Manus (an autonomous research agent,
-- api.manus.ai) to (a) research current public lottery-number
-- pattern/strategy techniques and (b) compare them against this app's
-- own actual backtest performance (pulled fresh from `backtests` and
-- `lottery_backtests` each run). Manus tasks are asynchronous — this
-- table tracks the request/response lifecycle via Manus's webhook.
--
-- This table is the only thing this migration creates. An earlier
-- draft of this migration also scheduled a Supabase pg_cron job
-- (`research_weekly_tick`) to trigger runs via an HTTP webhook and
-- Vault secrets — that was superseded by the Cloudflare-native task
-- before ever being applied to a database, so it's been removed here
-- rather than shipped as dead, unused SQL.
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

-- ------------------------------------------------------------------
-- One-time setup (Supabase SQL editor / Cloudflare dashboard, not
-- committed to git — unrelated to trigger frequency, needed regardless
-- of how often the job runs):
--
-- Set on Cloudflare:
--   MANUS_API_KEY   (from https://manus.im/app?show_settings=integrations&app_name=api)
--   RESEARCH_WEBHOOK_SECRET   (only needed if you ever use the manual
--                              /api/public/hooks/research-weekly fallback route)
--
-- And register the Manus webhook ONCE (not automatable — Manus's API
-- isn't reachable from a Cloudflare function during setup, this is a
-- one-off call you make yourself after deploying):
--
--   curl -X POST https://api.manus.ai/v2/webhook.create \
--     -H "Content-Type: application/json" \
--     -H "x-manus-api-key: $MANUS_API_KEY" \
--     -d '{"url":"https://<your-deployed-url>/api/public/hooks/manus-webhook","events":["task_stopped"]}'
-- ------------------------------------------------------------------
