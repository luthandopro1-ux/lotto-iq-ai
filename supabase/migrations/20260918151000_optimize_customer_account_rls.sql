-- Optimize customer account RLS policy auth checks.
-- Developer: Lum Tech Solutions
-- Equivalent authorization semantics; avoids per-row auth.uid() re-evaluation.

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (id = (select auth.uid()));
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = (select auth.uid()));
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS workspace_members_read_own ON public.workspace_members;
CREATE POLICY workspace_members_read_own ON public.workspace_members FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS workspace_members_insert_own ON public.workspace_members;
CREATE POLICY workspace_members_insert_own ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS workspace_members_update_own ON public.workspace_members;
CREATE POLICY workspace_members_update_own ON public.workspace_members FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS workspace_members_delete_own ON public.workspace_members;
CREATE POLICY workspace_members_delete_own ON public.workspace_members FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS workspaces_read_member ON public.workspaces;
CREATE POLICY workspaces_read_member ON public.workspaces FOR SELECT TO authenticated USING (owner_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = workspaces.id AND m.user_id = (select auth.uid())));
DROP POLICY IF EXISTS workspaces_insert_owner ON public.workspaces;
CREATE POLICY workspaces_insert_owner ON public.workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS workspaces_update_owner ON public.workspaces;
CREATE POLICY workspaces_update_owner ON public.workspaces FOR UPDATE TO authenticated USING (owner_id = (select auth.uid())) WITH CHECK (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS workspaces_delete_owner ON public.workspaces;
CREATE POLICY workspaces_delete_owner ON public.workspaces FOR DELETE TO authenticated USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS workspace_settings_read_member ON public.workspace_settings;
CREATE POLICY workspace_settings_read_member ON public.workspace_settings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = workspace_settings.workspace_id AND m.user_id = (select auth.uid())));
DROP POLICY IF EXISTS workspace_settings_insert_member ON public.workspace_settings;
CREATE POLICY workspace_settings_insert_member ON public.workspace_settings FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = workspace_settings.workspace_id AND m.user_id = (select auth.uid())));
DROP POLICY IF EXISTS workspace_settings_update_member ON public.workspace_settings;
CREATE POLICY workspace_settings_update_member ON public.workspace_settings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = workspace_settings.workspace_id AND m.user_id = (select auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = workspace_settings.workspace_id AND m.user_id = (select auth.uid())));
