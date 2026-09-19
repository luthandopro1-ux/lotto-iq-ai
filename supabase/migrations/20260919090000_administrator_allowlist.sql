-- Lotto IQ administrator allowlist
-- Developer: Lum Tech Solutions
--
-- Part of the authorization foundation described in the architecture
-- migration plan (Phase 2: "Central authentication and role resolution").
-- This is purely additive: it does not touch profiles, workspaces,
-- workspace_members, workspace_settings, or workspace_entitlements, and
-- it does not remove or replace ADMIN_API_KEY. The shared-secret admin
-- key remains the deployment/operator fallback until the account-based
-- boundary is verified in production, per the migration plan.

CREATE TABLE IF NOT EXISTS public.administrators (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;

-- Deliberately no SELECT/INSERT/UPDATE/DELETE grants to authenticated or
-- anon: the allowlist itself is never readable from a user's own session.
-- Only service_role (used from trusted server contexts, e.g. Supabase
-- Studio or a future admin-management server function) can manage it.
REVOKE ALL ON public.administrators FROM authenticated, anon;
GRANT ALL ON public.administrators TO service_role;

-- A user may only ever learn their OWN administrator status, via this
-- SECURITY DEFINER function, never the full allowlist. It takes no
-- parameters so it cannot be used to probe other users' status.
CREATE OR REPLACE FUNCTION public.is_administrator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.administrators WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_administrator() FROM public;
GRANT EXECUTE ON FUNCTION public.is_administrator() TO authenticated;
