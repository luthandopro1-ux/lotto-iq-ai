-- Strategy definitions contain private operating logic and are not public product content.
DROP POLICY IF EXISTS "strategies are publicly readable" ON public.strategies;
DROP POLICY IF EXISTS "strategies are open" ON public.strategies;
GRANT SELECT ON public.strategies TO authenticated;
REVOKE SELECT ON public.strategies FROM anon;
CREATE POLICY "strategies are administrator readable" ON public.strategies FOR SELECT TO authenticated USING (public.is_administrator());
