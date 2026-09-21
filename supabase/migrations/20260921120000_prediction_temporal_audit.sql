-- Temporal audit metadata for predictions.
-- Every prediction must identify the last draw used and the exact engine versions.

ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS history_cutoff_date date,
  ADD COLUMN IF NOT EXISTS history_cutoff_session text,
  ADD COLUMN IF NOT EXISTS history_cutoff_draw_id uuid REFERENCES public.draws(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS model_version text,
  ADD COLUMN IF NOT EXISTS feature_version text;

-- The prior immutability trigger would preserve NULL legacy values during
-- this backfill, so suspend it briefly and recreate the hardened version below.
DROP TRIGGER IF EXISTS predictions_lock ON public.predictions;

UPDATE public.predictions
SET model_version = COALESCE(model_version, 'legacy-unknown'),
    feature_version = COALESCE(feature_version, 'legacy-unknown')
WHERE model_version IS NULL OR feature_version IS NULL;

CREATE OR REPLACE FUNCTION public.predictions_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.target_date := OLD.target_date;
  NEW.target_session := OLD.target_session;
  NEW.generated_at := OLD.generated_at;
  NEW.locked_at := OLD.locked_at;
  NEW.banker := OLD.banker;
  NEW.bankers := OLD.bankers;
  NEW.rows := OLD.rows;
  NEW.pool := OLD.pool;
  NEW.learning := OLD.learning;
  NEW.sequence := OLD.sequence;
  NEW.strategy_count := OLD.strategy_count;
  NEW.history_depth := OLD.history_depth;
  NEW.strategy_version := OLD.strategy_version;
  NEW.history_cutoff_date := OLD.history_cutoff_date;
  NEW.history_cutoff_session := OLD.history_cutoff_session;
  NEW.history_cutoff_draw_id := OLD.history_cutoff_draw_id;
  NEW.model_version := OLD.model_version;
  NEW.feature_version := OLD.feature_version;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS predictions_lock ON public.predictions;
CREATE TRIGGER predictions_lock BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.predictions_immutable();

COMMENT ON COLUMN public.predictions.history_cutoff_date IS 'Latest calendar date available to the prediction engine.';
COMMENT ON COLUMN public.predictions.history_cutoff_session IS 'Latest session available to the prediction engine.';
COMMENT ON COLUMN public.predictions.history_cutoff_draw_id IS 'Exact latest draw row used by the prediction engine.';
COMMENT ON COLUMN public.predictions.model_version IS 'Version of the prediction model used.';
COMMENT ON COLUMN public.predictions.feature_version IS 'Version of the feature-generation contract used.';
