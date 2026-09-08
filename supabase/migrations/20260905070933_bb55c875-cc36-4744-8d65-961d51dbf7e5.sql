CREATE UNIQUE INDEX IF NOT EXISTS strategy_performance_strategy_window_key
  ON public.strategy_performance (strategy_id, window_label);
GRANT SELECT ON public.strategy_performance TO anon, authenticated;
GRANT ALL ON public.strategy_performance TO service_role;