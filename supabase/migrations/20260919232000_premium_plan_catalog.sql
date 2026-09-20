-- Premium catalog for Lum Tech Solutions.
-- ZAR is authoritative until a verified billing provider supplies localized prices.
CREATE TABLE IF NOT EXISTS public.premium_plans (
  code text PRIMARY KEY CHECK (code IN ('weekly', 'monthly', 'yearly')),
  label text NOT NULL,
  interval_days integer NOT NULL CHECK (interval_days IN (7, 30, 365)),
  price_minor integer NOT NULL CHECK (price_minor > 0),
  currency_code text NOT NULL DEFAULT 'ZAR' CHECK (currency_code = 'ZAR'),
  discount_percent integer NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  auto_renew boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.premium_plans (code, label, interval_days, price_minor, currency_code, discount_percent, auto_renew)
VALUES
  ('weekly', '7-day Premium', 7, 7000, 'ZAR', 0, true),
  ('monthly', 'Monthly Premium', 30, 28000, 'ZAR', 0, true),
  ('yearly', 'Yearly Premium', 365, 302400, 'ZAR', 10, true)
ON CONFLICT (code) DO UPDATE SET
  label = excluded.label,
  interval_days = excluded.interval_days,
  price_minor = excluded.price_minor,
  currency_code = excluded.currency_code,
  discount_percent = excluded.discount_percent,
  auto_renew = excluded.auto_renew,
  updated_at = now();

ALTER TABLE public.premium_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_plans FROM anon, authenticated;
GRANT SELECT ON public.premium_plans TO anon, authenticated;
GRANT ALL ON public.premium_plans TO service_role;
DROP POLICY IF EXISTS "premium_plans_public_catalog" ON public.premium_plans;
CREATE POLICY "premium_plans_public_catalog" ON public.premium_plans FOR SELECT TO anon, authenticated USING (enabled = true);

ALTER TABLE public.workspace_entitlements ADD COLUMN IF NOT EXISTS plan_interval text CHECK (plan_interval IN ('weekly', 'monthly', 'yearly'));
ALTER TABLE public.workspace_entitlements ADD COLUMN IF NOT EXISTS price_minor integer;
ALTER TABLE public.workspace_entitlements ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'ZAR';
ALTER TABLE public.workspace_entitlements ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true;
ALTER TABLE public.workspace_entitlements ADD COLUMN IF NOT EXISTS country_code text;
CREATE INDEX IF NOT EXISTS workspace_entitlements_interval_idx ON public.workspace_entitlements (plan_interval, status);
