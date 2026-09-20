-- Lotto IQ — per-strategy raw predictions
--
-- Stores each individual strategy's raw predicted numbers for a draw,
-- before ensembling. This is the piece daily.server.ts's grading loop
-- needs to persist runAnalysis()'s per-strategy output (via
-- latestAnalysisSnapshot()) rather than only the final ensembled board
-- that already lands in `predictions`.
--
-- Locked to administrator-only reads from the start, matching
-- 20260919211000_private_strategy_visibility.sql's treatment of the
-- `strategies` table itself: a per-strategy prediction reveals exactly
-- what a proprietary formula predicted, which is at least as sensitive
-- as the formula definition that policy was written to protect.

CREATE TABLE IF NOT EXISTS public.strategy_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL REFERENCES public.draws(id) ON DELETE CASCADE,
  strategy_id uuid NOT NULL REFERENCES public.strategies(id) ON DELETE CASCADE,
  draw_time text NOT NULL,
  predicted_numbers smallint[] NOT NULL DEFAULT '{}',
  predicted_banker smallint,
  predicted_bonus smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draw_id, strategy_id)
);

CREATE INDEX IF NOT EXISTS strategy_predictions_draw_idx
  ON public.strategy_predictions (draw_id);
CREATE INDEX IF NOT EXISTS strategy_predictions_strategy_idx
  ON public.strategy_predictions (strategy_id, created_at DESC);

ALTER TABLE public.strategy_predictions ENABLE ROW LEVEL SECURITY;

-- No client grants at all: daily.server.ts writes via serverDb()
-- (service role), which bypasses RLS entirely, so it needs no policy.
-- Only administrators may ever read this from the app.
REVOKE ALL ON public.strategy_predictions FROM anon, authenticated;
GRANT ALL ON public.strategy_predictions TO service_role;

DROP POLICY IF EXISTS "strategy_predictions are administrator readable" ON public.strategy_predictions;
CREATE POLICY "strategy_predictions are administrator readable" ON public.strategy_predictions
  FOR SELECT TO authenticated USING (public.is_administrator());

-- Bulk upsert for one draw's worth of per-strategy predictions at once.
-- p_predictions shape (one element per strategy):
--   { "strategy_id": uuid, "predicted_numbers": number[], "predicted_banker": number|null, "predicted_bonus": number|null }
CREATE OR REPLACE FUNCTION public.upsert_strategy_predictions(
  p_draw_id uuid,
  p_draw_time text,
  p_predictions jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.strategy_predictions
    (draw_id, strategy_id, draw_time, predicted_numbers, predicted_banker, predicted_bonus)
  SELECT
    p_draw_id,
    (elem->>'strategy_id')::uuid,
    p_draw_time,
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(elem->'predicted_numbers'))::smallint[],
      '{}'
    ),
    NULLIF(elem->>'predicted_banker', '')::smallint,
    NULLIF(elem->>'predicted_bonus', '')::smallint
  FROM jsonb_array_elements(p_predictions) AS elem
  ON CONFLICT (draw_id, strategy_id) DO UPDATE SET
    draw_time = excluded.draw_time,
    predicted_numbers = excluded.predicted_numbers,
    predicted_banker = excluded.predicted_banker,
    predicted_bonus = excluded.predicted_bonus,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_strategy_predictions(uuid, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_strategy_predictions(uuid, text, jsonb) TO service_role;
