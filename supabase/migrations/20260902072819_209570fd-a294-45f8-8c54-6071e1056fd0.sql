DROP POLICY IF EXISTS "strategies are open" ON public.strategies;
REVOKE INSERT, UPDATE, DELETE ON public.strategies FROM anon, authenticated;
GRANT SELECT ON public.strategies TO anon, authenticated;
GRANT ALL ON public.strategies TO service_role;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strategies are publicly readable" ON public.strategies FOR SELECT TO anon, authenticated USING (true);