-- ------------------------------------------------------------------
-- Russian lottery module (5/50, 6/45, 7/49)
--
-- Fully independent of the UK49 tables (draws, strategies, predictions,
-- analysis_runs, backtests) — nothing here is read or written by the
-- UK49 engine, and nothing in the UK49 engine is touched by this
-- migration. Same security posture as the rest of the app: anon/
-- authenticated get read-only SELECT, all writes go through the
-- service role via server functions.
-- ------------------------------------------------------------------

CREATE TABLE public.lottery_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,                -- 'ru_5_50' | 'ru_6_45' | 'ru_7_49'
  game_name text NOT NULL,
  country text NOT NULL DEFAULT 'Russia',
  number_range_min smallint NOT NULL DEFAULT 1,
  number_range_max smallint NOT NULL,
  numbers_drawn smallint NOT NULL,
  bankers_count smallint NOT NULL DEFAULT 3,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (number_range_max > number_range_min),
  CHECK (numbers_drawn > 0 AND numbers_drawn <= number_range_max - number_range_min + 1),
  CHECK (bankers_count > 0 AND bankers_count <= numbers_drawn)
);
GRANT SELECT ON public.lottery_games TO anon, authenticated;
GRANT ALL ON public.lottery_games TO service_role;
ALTER TABLE public.lottery_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lottery_games are readable" ON public.lottery_games FOR SELECT USING (true);

CREATE TABLE public.lottery_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.lottery_games(id) ON DELETE CASCADE,
  draw_date date NOT NULL,
  draw_number bigint NOT NULL,
  winning_numbers smallint[] NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, draw_number)
);
CREATE INDEX lottery_draws_game_date_idx ON public.lottery_draws (game_id, draw_date DESC);
GRANT SELECT ON public.lottery_draws TO anon, authenticated;
GRANT ALL ON public.lottery_draws TO service_role;
ALTER TABLE public.lottery_draws ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lottery_draws are readable" ON public.lottery_draws FOR SELECT USING (true);

CREATE TABLE public.lottery_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.lottery_games(id) ON DELETE CASCADE,
  target_draw_number bigint NOT NULL,
  draw_id uuid REFERENCES public.lottery_draws(id) ON DELETE SET NULL,
  bankers smallint[] NOT NULL,
  predicted_numbers smallint[] NOT NULL,
  strategy_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  composite_score jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','graded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, target_draw_number)
);
CREATE INDEX lottery_predictions_game_idx ON public.lottery_predictions (game_id, target_draw_number DESC);
GRANT SELECT ON public.lottery_predictions TO anon, authenticated;
GRANT ALL ON public.lottery_predictions TO service_role;
ALTER TABLE public.lottery_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lottery_predictions are readable" ON public.lottery_predictions FOR SELECT USING (true);

CREATE TABLE public.lottery_prediction_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid NOT NULL REFERENCES public.lottery_predictions(id) ON DELETE CASCADE,
  actual_numbers smallint[] NOT NULL,
  total_hits smallint NOT NULL,
  banker_hits smallint NOT NULL,
  matched_numbers smallint[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prediction_id)
);
GRANT SELECT ON public.lottery_prediction_results TO anon, authenticated;
GRANT ALL ON public.lottery_prediction_results TO service_role;
ALTER TABLE public.lottery_prediction_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lottery_prediction_results are readable" ON public.lottery_prediction_results FOR SELECT USING (true);

CREATE TABLE public.lottery_backtests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.lottery_games(id) ON DELETE CASCADE,
  label text,
  date_from date NOT NULL,
  date_to date NOT NULL,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lottery_backtests_game_idx ON public.lottery_backtests (game_id, created_at DESC);
GRANT SELECT ON public.lottery_backtests TO anon, authenticated;
GRANT ALL ON public.lottery_backtests TO service_role;
ALTER TABLE public.lottery_backtests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lottery_backtests are readable" ON public.lottery_backtests FOR SELECT USING (true);

INSERT INTO public.lottery_games (code, game_name, country, number_range_min, number_range_max, numbers_drawn, bankers_count) VALUES
  ('ru_5_50', 'Russia 5/50', 'Russia', 1, 50, 5, 3),
  ('ru_6_45', 'Russia 6/45', 'Russia', 1, 45, 6, 3),
  ('ru_7_49', 'Russia 7/49', 'Russia', 1, 49, 7, 3);
