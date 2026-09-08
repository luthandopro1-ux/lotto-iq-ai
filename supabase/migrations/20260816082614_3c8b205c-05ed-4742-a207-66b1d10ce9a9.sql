-- Draws
DROP POLICY IF EXISTS "draws are open" ON public.draws;
CREATE POLICY "draws are publicly readable" ON public.draws FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.draws FROM anon, authenticated;
GRANT SELECT ON public.draws TO anon, authenticated;
GRANT ALL ON public.draws TO service_role;

-- Analysis runs
DROP POLICY IF EXISTS "analysis_runs are open" ON public.analysis_runs;
CREATE POLICY "analysis_runs are publicly readable" ON public.analysis_runs FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.analysis_runs FROM anon, authenticated;
GRANT SELECT ON public.analysis_runs TO anon, authenticated;
GRANT ALL ON public.analysis_runs TO service_role;

-- Backtests
DROP POLICY IF EXISTS "backtests are open" ON public.backtests;
CREATE POLICY "backtests are publicly readable" ON public.backtests FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.backtests FROM anon, authenticated;
GRANT SELECT ON public.backtests TO anon, authenticated;
GRANT ALL ON public.backtests TO service_role;

-- Ingest runs
DROP POLICY IF EXISTS "ingest_runs are open" ON public.ingest_runs;
CREATE POLICY "ingest_runs are publicly readable" ON public.ingest_runs FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.ingest_runs FROM anon, authenticated;
GRANT SELECT ON public.ingest_runs TO anon, authenticated;
GRANT ALL ON public.ingest_runs TO service_role;

-- Predictions
DROP POLICY IF EXISTS "predictions are open" ON public.predictions;
CREATE POLICY "predictions are publicly readable" ON public.predictions FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.predictions FROM anon, authenticated;
GRANT SELECT ON public.predictions TO anon, authenticated;
GRANT ALL ON public.predictions TO service_role;

-- Strategy performance
DROP POLICY IF EXISTS "strategy_performance is open" ON public.strategy_performance;
CREATE POLICY "strategy_performance is publicly readable" ON public.strategy_performance FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.strategy_performance FROM anon, authenticated;
GRANT SELECT ON public.strategy_performance TO anon, authenticated;
GRANT ALL ON public.strategy_performance TO service_role;
