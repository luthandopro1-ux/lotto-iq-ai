import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PublicPageShell, PublicSection } from "@/components/PublicPageShell";

type Preferences = {
  user_id: string;
  draw_alerts_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};
type PreferencesDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => { maybeSingle: () => Promise<{ data: Preferences | null; error: Error | null }> };
    };
    upsert: (
      values: Preferences,
      options?: { onConflict?: string },
    ) => Promise<{ error: Error | null }>;
  };
};

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Lotto IQ — Notification Preferences" },
      { name: "description", content: "Notification consent preferences for Lotto IQ." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Omit<Preferences, "user_id">>({
    draw_alerts_enabled: false,
    email_enabled: false,
    push_enabled: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!auth.user) {
        setLoading(false);
        return;
      }
      setUserId(auth.user.id);
      const db = supabase as unknown as PreferencesDb;
      const result = await db
        .from("notification_preferences")
        .select(
          "user_id,draw_alerts_enabled,email_enabled,push_enabled,quiet_hours_start,quiet_hours_end",
        )
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (result.data && mounted)
        setPrefs({
          draw_alerts_enabled: result.data.draw_alerts_enabled,
          email_enabled: result.data.email_enabled,
          push_enabled: result.data.push_enabled,
          quiet_hours_start: result.data.quiet_hours_start,
          quiet_hours_end: result.data.quiet_hours_end,
        });
      setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const db = supabase as unknown as PreferencesDb;
    const result = await db
      .from("notification_preferences")
      .upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
    if (result.error) toast.error(result.error.message);
    else toast.success("Notification preferences saved.");
    setSaving(false);
  };

  if (!loading && !userId)
    return (
      <PublicPageShell eyebrow="Notifications" title="Notification preferences">
        <p>
          Please{" "}
          <Link className="text-primary hover:underline" to="/account">
            sign in
          </Link>{" "}
          before changing notification consent.
        </p>
      </PublicPageShell>
    );

  const toggle = (key: "draw_alerts_enabled" | "email_enabled" | "push_enabled") =>
    setPrefs((current) => ({ ...current, [key]: !current[key] }));
  return (
    <PublicPageShell eyebrow="Notifications" title="Choose what Lotto IQ may notify you about">
      <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm leading-6">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            All notification options are off by default. This page records consent preferences only;
            no delivery provider is active yet.
          </p>
        </div>
      </div>
      <PublicSection title="Consent controls">
        <div className="space-y-3">
          {(
            [
              [
                "draw_alerts_enabled",
                "Draw-session alerts",
                "Allow Lotto IQ to prepare alerts related to relevant draw sessions.",
              ],
              [
                "email_enabled",
                "Email delivery",
                "Allow future email delivery after an email provider and unsubscribe flow are configured.",
              ],
              [
                "push_enabled",
                "Push delivery",
                "Allow future device push delivery after an Android/PWA push provider is configured.",
              ],
            ] as const
          ).map(([key, label, description]) => (
            <label
              key={key}
              className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border/70 p-4"
            >
              <span>
                <span className="flex items-center gap-2 font-semibold text-foreground">
                  <Bell className="size-4 text-primary" />
                  {label}
                </span>
                <span className="mt-1 block text-xs leading-5">{description}</span>
              </span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={() => toggle(key)}
                className="mt-1 size-4 accent-primary"
              />
            </label>
          ))}
        </div>
      </PublicSection>
      <button
        type="button"
        onClick={() => void save()}
        disabled={loading || saving}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving && <Loader2 className="size-4 animate-spin" />}Save preferences
      </button>
      <p className="text-xs">
        You can change these choices later. Read the{" "}
        <Link className="text-primary hover:underline" to="/privacy">
          Privacy Policy
        </Link>{" "}
        for account and data information.
      </p>
    </PublicPageShell>
  );
}
