-- Harden customer workspace membership and bootstrap boundaries.
-- Developer: Lum Tech Solutions
-- Ordinary authenticated clients may read their own membership, but may not
-- create, alter, or delete membership rows. Initial workspace provisioning is
-- performed atomically by the narrowly scoped bootstrap RPC below.

REVOKE INSERT, UPDATE, DELETE ON public.workspace_members FROM authenticated;

DROP POLICY IF EXISTS workspace_members_insert_own ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_update_own ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_delete_own ON public.workspace_members;

DROP POLICY IF EXISTS workspace_settings_insert_member ON public.workspace_settings;
CREATE POLICY workspace_settings_insert_owner_editor ON public.workspace_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = workspace_settings.workspace_id
        AND m.user_id = (select auth.uid())
        AND m.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS workspace_settings_update_member ON public.workspace_settings;
CREATE POLICY workspace_settings_update_owner_editor ON public.workspace_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = workspace_settings.workspace_id
        AND m.user_id = (select auth.uid())
        AND m.role IN ('owner', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = workspace_settings.workspace_id
        AND m.user_id = (select auth.uid())
        AND m.role IN ('owner', 'editor')
    )
  );

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

  -- Serialize bootstrap for one user so the unique owner index cannot produce
  -- partially initialized duplicate workspaces under concurrent requests.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  INSERT INTO public.profiles (id, display_name)
  VALUES (v_user_id, v_display_name)
  ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);

  SELECT w.id, w.name
    INTO v_workspace_id, v_workspace_name
    FROM public.workspaces w
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

  RETURN QUERY SELECT v_user_id, v_workspace_id, v_workspace_name;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_personal_account(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_personal_account(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_personal_account(text) TO authenticated;
