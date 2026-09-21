-- Lotto IQ AI — Lum Tech Solutions
-- Corrective migration: the original entitlement check constraint predated
-- the Early Bird source and must explicitly allow it.

ALTER TABLE public.workspace_entitlements
  DROP CONSTRAINT IF EXISTS workspace_entitlements_source_check;

ALTER TABLE public.workspace_entitlements
  ADD CONSTRAINT workspace_entitlements_source_check
  CHECK (source IN ('system', 'manual', 'early_bird_promo', 'stripe', 'google_play', 'apple_app_store'));
