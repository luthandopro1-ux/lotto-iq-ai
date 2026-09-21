-- Lotto IQ AI — Lum Tech Solutions
-- Personal client workspace bootstrap
--
-- Prerequisites:
--   public.profiles, public.workspaces, public.workspace_members,
--   public.workspace_settings, and public.workspace_entitlements exist.
--   The caller is authenticated through Supabase Auth.
--
-- Registration remains Free. This function does not grant Premium or Early Bird.

CREATE OR REPLACE FUNCTION public.bootstrap_personal_account(p_display_name text DEFAULT NULL)
RETURNS TABLE (user_id uuid, workspace_id uuid, workspace_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_workspace_name text;
  v_display_name text := NULLIF(btrim(p_display_name), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF v_display_name IS NOT NULL AND char_length(v_display_name) > 80 THEN
    RAISE EXCEPTION 'Display name is too long' USING ERRCODE = '22001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  INSERT INTO public.profiles (id, display_name)
  VALUES (v_user_id, v_display_name)
  ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);

  SELECT w.id, w.name
  INTO v_workspace_id, v_workspace_name
  FROM public.workspaces AS w
  WHERE w.owner_id = v_user_id
  FOR UPDATE;

  IF v_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, owner_id)
    VALUES ('My Lotto IQ workspace', v_user_id)
    RETURNING id, name INTO v_workspace_id, v_workspace_name;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = 'owner';

  INSERT INTO public.workspace_settings (workspace_id, game_code, timezone)
  VALUES (v_workspace_id, 'UK49', 'Africa/Johannesburg')
  ON CONFLICT (workspace_id) DO NOTHING;

  INSERT INTO public.workspace_entitlements (
    workspace_id, plan_code, status, source, feature_limits
  )
  VALUES (
    v_workspace_id,
    'free',
    'active',
    'system',
    '{"saved_strategies": 3, "backtest_days": 90, "history_depth": 200}'::jsonb
  )
  ON CONFLICT (workspace_id) DO NOTHING;

  RETURN QUERY
  SELECT v_user_id, v_workspace_id, v_workspace_name;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_personal_account(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_personal_account(text) TO authenticated;

-- Post-deployment check:
-- SELECT public.bootstrap_personal_account('Test Client');
-- Run the check only while authenticated as the intended test client.
