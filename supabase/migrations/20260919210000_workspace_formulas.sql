-- Customer-owned formulas. Formula text is private workspace data.
CREATE TABLE IF NOT EXISTS public.workspace_formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  expression text NOT NULL CHECK (char_length(expression) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_formulas_workspace_idx ON public.workspace_formulas(workspace_id, created_at DESC);
ALTER TABLE public.workspace_formulas ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_formulas TO authenticated;
GRANT ALL ON public.workspace_formulas TO service_role;

DROP POLICY IF EXISTS workspace_formulas_read_member ON public.workspace_formulas;
CREATE POLICY workspace_formulas_read_member ON public.workspace_formulas FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = workspace_formulas.workspace_id AND m.user_id = (select auth.uid())
  )
);
DROP POLICY IF EXISTS workspace_formulas_insert_owner ON public.workspace_formulas;
CREATE POLICY workspace_formulas_insert_owner ON public.workspace_formulas FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = workspace_formulas.workspace_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner', 'editor')
  )
);
DROP POLICY IF EXISTS workspace_formulas_update_owner ON public.workspace_formulas;
CREATE POLICY workspace_formulas_update_owner ON public.workspace_formulas FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = workspace_formulas.workspace_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner', 'editor')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = workspace_formulas.workspace_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner', 'editor')
  )
);
DROP POLICY IF EXISTS workspace_formulas_delete_owner ON public.workspace_formulas;
CREATE POLICY workspace_formulas_delete_owner ON public.workspace_formulas FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = workspace_formulas.workspace_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner', 'editor')
  )
);

DROP TRIGGER IF EXISTS workspace_formulas_touch_updated_at ON public.workspace_formulas;
CREATE TRIGGER workspace_formulas_touch_updated_at BEFORE UPDATE ON public.workspace_formulas FOR EACH ROW EXECUTE FUNCTION public.touch_account_updated_at();
