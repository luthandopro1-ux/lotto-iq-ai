-- Lotto IQ notification consent foundation
-- Developer: Lum Tech Solutions
-- Preferences are stored separately from delivery. No provider is connected by this migration.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  draw_alerts_enabled boolean NOT NULL DEFAULT false,
  email_enabled boolean NOT NULL DEFAULT false,
  push_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

DROP POLICY IF EXISTS notification_preferences_own_read ON public.notification_preferences;
CREATE POLICY notification_preferences_own_read ON public.notification_preferences FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS notification_preferences_own_insert ON public.notification_preferences;
CREATE POLICY notification_preferences_own_insert ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS notification_preferences_own_update ON public.notification_preferences;
CREATE POLICY notification_preferences_own_update ON public.notification_preferences FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

DROP TRIGGER IF EXISTS notification_preferences_touch_updated_at ON public.notification_preferences;
CREATE TRIGGER notification_preferences_touch_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.touch_account_updated_at();
