-- Lotto IQ customer account foundation
-- Developer: Lum Tech Solutions
-- This migration is intentionally separate from the current global UK49 tables.
-- It creates personal workspaces without changing public draw/strategy behavior.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Lotto IQ workspace',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  game_code text NOT NULL DEFAULT 'UK49',
  timezone text NOT NULL DEFAULT 'Africa/Johannesburg',
  default_session text CHECK (default_session IN ('brunch', 'lunch', 'drivetime', 'teatime')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON public.workspace_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_personal_workspace_per_owner ON public.workspaces(owner_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workspace_settings TO authenticated;
GRANT ALL ON public.profiles, public.workspaces, public.workspace_members, public.workspace_settings TO service_role;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "workspace_members_read_own" ON public.workspace_members;
CREATE POLICY "workspace_members_read_own" ON public.workspace_members FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "workspace_members_insert_own" ON public.workspace_members;
CREATE POLICY "workspace_members_insert_own" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "workspace_members_update_own" ON public.workspace_members;
CREATE POLICY "workspace_members_update_own" ON public.workspace_members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "workspace_members_delete_own" ON public.workspace_members;
CREATE POLICY "workspace_members_delete_own" ON public.workspace_members FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "workspaces_read_member" ON public.workspaces;
CREATE POLICY "workspaces_read_member" ON public.workspaces FOR SELECT TO authenticated USING (
  owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = workspaces.id AND m.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "workspaces_insert_owner" ON public.workspaces;
CREATE POLICY "workspaces_insert_owner" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "workspaces_update_owner" ON public.workspaces;
CREATE POLICY "workspaces_update_owner" ON public.workspaces FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "workspaces_delete_owner" ON public.workspaces;
CREATE POLICY "workspaces_delete_owner" ON public.workspaces FOR DELETE TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspace_settings_read_member" ON public.workspace_settings;
CREATE POLICY "workspace_settings_read_member" ON public.workspace_settings FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = workspace_settings.workspace_id AND m.user_id = auth.uid())
);
DROP POLICY IF EXISTS "workspace_settings_insert_member" ON public.workspace_settings;
CREATE POLICY "workspace_settings_insert_member" ON public.workspace_settings FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = workspace_settings.workspace_id AND m.user_id = auth.uid())
);
DROP POLICY IF EXISTS "workspace_settings_update_member" ON public.workspace_settings;
CREATE POLICY "workspace_settings_update_member" ON public.workspace_settings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = workspace_settings.workspace_id AND m.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = workspace_settings.workspace_id AND m.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.touch_account_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_account_updated_at();
DROP TRIGGER IF EXISTS workspaces_touch_updated_at ON public.workspaces;
CREATE TRIGGER workspaces_touch_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.touch_account_updated_at();
DROP TRIGGER IF EXISTS workspace_settings_touch_updated_at ON public.workspace_settings;
CREATE TRIGGER workspace_settings_touch_updated_at BEFORE UPDATE ON public.workspace_settings FOR EACH ROW EXECUTE FUNCTION public.touch_account_updated_at();
