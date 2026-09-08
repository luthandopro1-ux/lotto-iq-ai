ALTER TABLE public.draws
  ADD COLUMN IF NOT EXISTS drawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS provider text;

CREATE UNIQUE INDEX IF NOT EXISTS draws_date_session_key ON public.draws (draw_date, session);

ALTER TABLE public.strategies
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'custom';

CREATE TABLE public.ingest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  mode text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  found integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  rejected integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  error text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingest_runs TO anon, authenticated;
GRANT ALL ON public.ingest_runs TO service_role;
ALTER TABLE public.ingest_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingest_runs are open" ON public.ingest_runs FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date date NOT NULL,
  target_session text NOT NULL,
  previous_draw_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  top_numbers jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_pairs jsonb NOT NULL DEFAULT '[]'::jsonb,
  breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  strategy_count integer NOT NULL DEFAULT 0,
  trigger text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analysis_runs_target_idx ON public.analysis_runs (target_date DESC, target_session);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_runs TO anon, authenticated;
GRANT ALL ON public.analysis_runs TO service_role;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analysis_runs are open" ON public.analysis_runs FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.strategy_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL REFERENCES public.strategies(id) ON DELETE CASCADE,
  tests integer NOT NULL DEFAULT 0,
  matches integer NOT NULL DEFAULT 0,
  avg_matches numeric NOT NULL DEFAULT 0,
  pair_matches integer NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  window_label text NOT NULL DEFAULT 'all',
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (strategy_id, window_label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_performance TO anon, authenticated;
GRANT ALL ON public.strategy_performance TO service_role;
ALTER TABLE public.strategy_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strategy_performance is open" ON public.strategy_performance FOR ALL USING (true) WITH CHECK (true);