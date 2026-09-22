-- Public Premium catalog consolidation.
--
-- Weekly and yearly rows are preserved for entitlement and audit history but
-- are no longer active catalog items. Existing customer entitlements retain
-- their recorded interval and must continue to be honored until their
-- server-side period ends or changes through a verified billing flow.

UPDATE public.premium_plans
SET enabled = CASE WHEN code = 'monthly' THEN true ELSE false END,
    updated_at = now()
WHERE code IN ('weekly', 'monthly', 'yearly');

COMMENT ON TABLE public.premium_plans IS
  'Public catalog currently exposes Monthly Premium only; legacy intervals remain for billing history.';
