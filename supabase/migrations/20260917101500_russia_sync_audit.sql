CREATE TABLE IF NOT EXISTS public.lottery_ingest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.lottery_games(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','ok','failed','retired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  found integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  error text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS lottery_ingest_runs_game_started_idx
  ON public.lottery_ingest_runs (game_id, started_at DESC);
ALTER TABLE public.lottery_ingest_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.lottery_ingest_runs TO anon, authenticated;
GRANT ALL ON public.lottery_ingest_runs TO service_role;
DROP POLICY IF EXISTS "lottery_ingest_runs are readable" ON public.lottery_ingest_runs;
CREATE POLICY "lottery_ingest_runs are readable" ON public.lottery_ingest_runs FOR SELECT USING (true);

UPDATE public.lottery_games
SET active = false, game_name = 'Russia 5/50 (retired 2021-01-25)'
WHERE code = 'ru_5_50';

CREATE INDEX IF NOT EXISTS lottery_draws_game_number_idx
  ON public.lottery_draws (game_id, draw_number DESC);
