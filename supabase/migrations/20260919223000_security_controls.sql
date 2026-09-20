-- Security controls for Lum Tech Solutions.
-- Administrators can revoke application access without ever reading a password.
CREATE TABLE IF NOT EXISTS public.account_access_controls (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('revoke_access', 'restore_access', 'generate_recovery_link', 'update_security_setting')),
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_access_controls_status_idx ON public.account_access_controls (status, changed_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON public.admin_audit_log (target_user_id, created_at DESC);

ALTER TABLE public.account_access_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_access_controls FROM anon, authenticated;
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
GRANT ALL ON public.account_access_controls, public.admin_audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_access_status()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT coalesce((SELECT status FROM public.account_access_controls WHERE user_id = auth.uid()), 'active');
$$;

CREATE OR REPLACE FUNCTION public.admin_set_account_access(p_user_id uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_administrator() THEN RAISE EXCEPTION 'administrator access required'; END IF;
  IF p_status NOT IN ('active', 'suspended', 'revoked') THEN RAISE EXCEPTION 'invalid access status'; END IF;
  IF EXISTS (SELECT 1 FROM public.administrators WHERE user_id = p_user_id) THEN RAISE EXCEPTION 'administrator access cannot be changed here'; END IF;
  INSERT INTO public.account_access_controls (user_id, status, reason, changed_by, changed_at)
  VALUES (p_user_id, p_status, nullif(trim(p_reason), ''), auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET status = excluded.status, reason = excluded.reason, changed_by = excluded.changed_by, changed_at = now();
  INSERT INTO public.admin_audit_log (actor_user_id, action, target_user_id, metadata)
  VALUES (auth.uid(), CASE WHEN p_status = 'active' THEN 'restore_access' ELSE 'revoke_access' END, p_user_id, jsonb_build_object('status', p_status, 'reason', nullif(trim(p_reason), '')));
  RETURN jsonb_build_object('user_id', p_user_id, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_security_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_administrator() THEN RAISE EXCEPTION 'administrator access required'; END IF;
  RETURN jsonb_build_object(
    'accounts', jsonb_build_object(
      'registered', (SELECT count(*) FROM auth.users),
      'created_last_24h', (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '24 hours'),
      'confirmed', (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL),
      'controlled', (SELECT count(*) FROM public.account_access_controls WHERE status <> 'active')
    ),
    'controls', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.changed_at DESC) FROM public.account_access_controls c), '[]'::jsonb),
    'audit', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC) FROM (SELECT * FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 100) a), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_access_status() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_access_status() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_account_access(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_account_access(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_admin_security_overview() FROM public;
GRANT EXECUTE ON FUNCTION public.get_admin_security_overview() TO authenticated;
