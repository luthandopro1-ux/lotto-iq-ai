-- Lum Tech Solutions / Lotto IQ Phase 1 analytics foundation.
-- Additive only: current Worker-side engines and user-facing routes remain unchanged.

CREATE TABLE IF NOT EXISTS public.analytics_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_version text NOT NULL DEFAULT 'analytics.v1',
  kind text NOT NULL CHECK (kind IN ('analysis', 'backtest', 'feature-generation', 'model-evaluation')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  request_id text NOT NULL,
  model_version text NOT NULL DEFAULT 'typescript-live.v1',
  feature_version text NOT NULL DEFAULT 'uk49-features.v1',
  strategy_set_version text NOT NULL DEFAULT 'strategy-set.v1',
  parameters_hash text NOT NULL DEFAULT repeat('0', 64) CHECK (parameters_hash ~ '^[0-9a-f]{64}$'),
  source_draw_watermark date,
  error_class text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

REVOKE ALL ON public.analytics_jobs FROM anon, authenticated;
GRANT ALL ON public.analytics_jobs TO service_role;
ALTER TABLE public.analytics_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS contract_version text NOT NULL DEFAULT 'analytics.v1',
  ADD COLUMN IF NOT EXISTS model_version text NOT NULL DEFAULT 'typescript-live.v1',
  ADD COLUMN IF NOT EXISTS feature_version text NOT NULL DEFAULT 'uk49-features.v1',
  ADD COLUMN IF NOT EXISTS strategy_set_version text NOT NULL DEFAULT 'strategy-set.v1',
  ADD COLUMN IF NOT EXISTS parameters_hash text NOT NULL DEFAULT repeat('0', 64),
  ADD COLUMN IF NOT EXISTS source_draw_watermark date,
  ADD COLUMN IF NOT EXISTS execution_status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.analytics_jobs(id) ON DELETE SET NULL;

ALTER TABLE public.analysis_runs
  DROP CONSTRAINT IF EXISTS analysis_runs_execution_status_check;
ALTER TABLE public.analysis_runs
  ADD CONSTRAINT analysis_runs_execution_status_check
  CHECK (execution_status IN ('queued', 'running', 'completed', 'failed'));
ALTER TABLE public.analysis_runs
  DROP CONSTRAINT IF EXISTS analysis_runs_parameters_hash_check;
ALTER TABLE public.analysis_runs
  ADD CONSTRAINT analysis_runs_parameters_hash_check
  CHECK (parameters_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE public.backtests
  ADD COLUMN IF NOT EXISTS contract_version text NOT NULL DEFAULT 'analytics.v1',
  ADD COLUMN IF NOT EXISTS model_version text NOT NULL DEFAULT 'typescript-live.v1',
  ADD COLUMN IF NOT EXISTS feature_version text NOT NULL DEFAULT 'uk49-features.v1',
  ADD COLUMN IF NOT EXISTS strategy_set_version text NOT NULL DEFAULT 'strategy-set.v1',
  ADD COLUMN IF NOT EXISTS parameters_hash text NOT NULL DEFAULT repeat('0', 64),
  ADD COLUMN IF NOT EXISTS source_draw_watermark date,
  ADD COLUMN IF NOT EXISTS execution_status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.analytics_jobs(id) ON DELETE SET NULL;

ALTER TABLE public.backtests
  DROP CONSTRAINT IF EXISTS backtests_execution_status_check;
ALTER TABLE public.backtests
  ADD CONSTRAINT backtests_execution_status_check
  CHECK (execution_status IN ('queued', 'running', 'completed', 'failed'));
ALTER TABLE public.backtests
  DROP CONSTRAINT IF EXISTS backtests_parameters_hash_check;
ALTER TABLE public.backtests
  ADD CONSTRAINT backtests_parameters_hash_check
  CHECK (parameters_hash ~ '^[0-9a-f]{64}$');

CREATE INDEX IF NOT EXISTS draws_date_session_idx
  ON public.draws (draw_date DESC, session);
CREATE INDEX IF NOT EXISTS analysis_runs_target_created_idx
  ON public.analysis_runs (target_date DESC, target_session, created_at DESC);
CREATE INDEX IF NOT EXISTS analysis_runs_status_created_idx
  ON public.analysis_runs (execution_status, created_at DESC);
CREATE INDEX IF NOT EXISTS analysis_runs_job_idx
  ON public.analysis_runs (job_id)
  WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS backtests_window_created_idx
  ON public.backtests (date_from, date_to, created_at DESC);
CREATE INDEX IF NOT EXISTS backtests_status_created_idx
  ON public.backtests (execution_status, created_at DESC);
CREATE INDEX IF NOT EXISTS backtests_job_idx
  ON public.backtests (job_id)
  WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS predictions_target_created_idx
  ON public.predictions (target_date DESC, target_session, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_jobs_status_created_idx
  ON public.analytics_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_jobs_request_idx
  ON public.analytics_jobs (request_id);

COMMENT ON TABLE public.analytics_jobs IS 'Phase-gated asynchronous analytics boundary. Service-role access only until durable workers are enabled.';
COMMENT ON COLUMN public.analysis_runs.parameters_hash IS 'SHA-256 of non-secret analysis parameters; legacy rows use a zero hash.';
COMMENT ON COLUMN public.backtests.parameters_hash IS 'SHA-256 of non-secret backtest parameters; legacy rows use a zero hash.';
COMMENT ON COLUMN public.analysis_runs.source_draw_watermark IS 'Latest draw date available to the analysis engine.';
COMMENT ON COLUMN public.backtests.source_draw_watermark IS 'Latest draw date available to the backtest engine.';
