CREATE TABLE public.draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_date date NOT NULL,
  session text NOT NULL CHECK (session IN ('brunch','lunch','drivetime','teatime')),
  n1 smallint NOT NULL CHECK (n1 BETWEEN 1 AND 49),
  n2 smallint NOT NULL CHECK (n2 BETWEEN 1 AND 49),
  n3 smallint NOT NULL CHECK (n3 BETWEEN 1 AND 49),
  n4 smallint NOT NULL CHECK (n4 BETWEEN 1 AND 49),
  n5 smallint NOT NULL CHECK (n5 BETWEEN 1 AND 49),
  n6 smallint NOT NULL CHECK (n6 BETWEEN 1 AND 49),
  booster smallint CHECK (booster BETWEEN 1 AND 49),
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draw_date, session)
);
CREATE INDEX draws_date_idx ON public.draws (draw_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.draws TO anon, authenticated;
GRANT ALL ON public.draws TO service_role;
ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;
CREATE POLICY "draws are open" ON public.draws FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  rule_type text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight numeric NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategies TO anon, authenticated;
GRANT ALL ON public.strategies TO service_role;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strategies are open" ON public.strategies FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.backtests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text,
  date_from date NOT NULL,
  date_to date NOT NULL,
  strategy_ids uuid[] NOT NULL DEFAULT '{}',
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backtests TO anon, authenticated;
GRANT ALL ON public.backtests TO service_role;
ALTER TABLE public.backtests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backtests are open" ON public.backtests FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER strategies_touch BEFORE UPDATE ON public.strategies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.strategies (name, description, rule_type, params, weight, notes) VALUES
('Date x Number','Multiply the draw day by each previous number','date_x_number','{}',1,'Classic seed rule'),
('50 minus Date','Subtracts the draw day from 50','fifty_minus_date','{}',1,null),
('Date x Time x 49','Day multiplied by session index and 49','date_time_49','{}',1,null),
('Split Numbers','Splits two-digit numbers into their digits','split_numbers','{}',1,null),
('Reverse Numbers','Reverses the digits of each number','reverse_numbers','{}',1,null),
('Add Digits','Adds the digits of each number','add_digits','{}',1,null),
('Multiply Digits','Multiplies the digits of each number','multiply_digits','{}',1,null),
('Sum Six Numbers','Sum of all six numbers, normalised','sum_six','{}',1,null),
('Minus Booster','Each number minus the booster','minus_booster','{}',1,null),
('Previous Draw Analysis','Uses the previous draw as the seed','previous_draw','{}',1,null),
('Previous Three Draws','Overlap across the last three draws','previous_three','{}',1.5,'Higher weight');