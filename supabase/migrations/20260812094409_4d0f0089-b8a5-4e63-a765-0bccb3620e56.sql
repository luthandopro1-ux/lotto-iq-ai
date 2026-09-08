CREATE TABLE public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date date NOT NULL,
  target_session text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  banker smallint,
  bankers jsonb NOT NULL DEFAULT '[]'::jsonb,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  pool jsonb NOT NULL DEFAULT '[]'::jsonb,
  learning jsonb NOT NULL DEFAULT '{}'::jsonb,
  strategy_count integer NOT NULL DEFAULT 0,
  history_depth integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  draw_id uuid REFERENCES public.draws(id) ON DELETE SET NULL,
  actual jsonb,
  grading jsonb,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_date, target_session)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "predictions are open" ON public.predictions FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX predictions_date_idx ON public.predictions (target_date DESC, target_session);