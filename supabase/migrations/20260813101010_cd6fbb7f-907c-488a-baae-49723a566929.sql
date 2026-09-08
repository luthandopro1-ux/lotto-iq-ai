ALTER TABLE public.draws
  ADD COLUMN IF NOT EXISTS session_verified boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS locked_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS matched_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sequence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS session_state text NOT NULL DEFAULT 'PREDICTION_READY',
  ADD COLUMN IF NOT EXISTS strategy_version text;

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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS predictions_lock ON public.predictions;
CREATE TRIGGER predictions_lock BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.predictions_immutable();