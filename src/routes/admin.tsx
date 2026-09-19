import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Panel } from "@/components/AppShell";
import { SyncLog } from "@/components/SyncLog";
import { SyncPanel } from "@/components/SyncPanel";
import { Activity, Database, Library, LockKeyhole, ShieldCheck, Target } from "lucide-react";
import { getAccessContext } from "@/lib/customer.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Lotto IQ AI — Admin Operations" },
      {
        name: "description",
        content:
          "Lum Tech Solutions operator dashboard for Lotto IQ AI data and analysis operations.",
      },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const {
    data: access,
    isLoading: accessLoading,
    error: accessError,
  } = useQuery({
    queryKey: ["access-context"],
    queryFn: () => getAccessContext(),
  });
  const isAdministrator = access?.role === "administrator";

  const { data: draws = [], isLoading: drawsLoading } = useQuery({
    queryKey: ["admin", "draws-count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("draws").select("id").limit(1000);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
    enabled: isAdministrator,
  });

  const { data: strategies = [], isLoading: strategiesLoading } = useQuery({
    queryKey: ["admin", "strategies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategies")
        .select("id,name,enabled,category,rule_type,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
    enabled: isAdministrator,
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ["admin", "predictions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions")
        .select("id,status,outcome,target_date,target_session,created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
    enabled: isAdministrator,
  });

  if (accessLoading)
    return (
      <AppShell>
        <div className="py-20 text-center text-sm text-muted-foreground">
          Checking administrator access…
        </div>
      </AppShell>
    );
  if (accessError || !isAdministrator)
    return (
      <AppShell>
        <div className="mx-auto max-w-lg py-20 text-center">
          <LockKeyhole className="mx-auto size-10 text-destructive" />
          <h1 className="mt-5 font-display text-2xl font-bold">Administrator access required</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This is a protected operator console. Your customer account cannot read platform
            operations or private strategy definitions.
          </p>
        </div>
      </AppShell>
    );

  const activeStrategies = strategies.filter((strategy) => strategy.enabled).length;
  const gradedPredictions = predictions.filter((prediction) => prediction.outcome != null).length;

  const stats = [
    {
      label: "Draw rows sampled",
      value: drawsLoading ? "…" : draws.length >= 1000 ? "1,000+" : draws.length,
      icon: Database,
    },
    {
      label: "Active strategies",
      value: strategiesLoading ? "…" : activeStrategies,
      icon: Library,
    },
    { label: "Recent predictions", value: predictions.length, icon: Target },
    { label: "Graded in view", value: gradedPredictions, icon: Activity },
  ];

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-primary/20 bg-primary/10 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <ShieldCheck className="size-4" /> Lum Tech Solutions operations
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold">Admin dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Monitor Lotto IQ data freshness, strategy configuration, ingestion runs, and prediction
            ledger activity. Customer accounts and Premium billing are not part of this operator
            view yet.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
          <LockKeyhole className="size-4 text-primary" />
          Writes require the saved admin key
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass glass-hover rounded-2xl p-5">
            <Icon className="size-4 text-primary" />
            <p className="mt-3 font-display text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <SyncPanel />
      <SyncLog />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="Strategy configuration"
          action={
            <a href="/strategies" className="text-xs text-primary hover:underline">
              Open strategy manager
            </a>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="text-left uppercase tracking-widest text-muted-foreground">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Rule</th>
                  <th className="pb-2">State</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((strategy) => (
                  <tr key={strategy.id} className="border-t border-border/60">
                    <td className="py-2 font-medium">{strategy.name}</td>
                    <td className="py-2 text-muted-foreground">{strategy.category}</td>
                    <td className="py-2 font-mono text-muted-foreground">{strategy.rule_type}</td>
                    <td
                      className={`py-2 ${strategy.enabled ? "text-emerald-400" : "text-muted-foreground"}`}
                    >
                      {strategy.enabled ? "enabled" : "disabled"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {strategies.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No strategies returned.</p>
            )}
          </div>
        </Panel>

        <Panel
          title="Recent prediction ledger"
          action={
            <a href="/history" className="text-xs text-primary hover:underline">
              Open ledger
            </a>
          }
        >
          <div className="space-y-3">
            {predictions.map((prediction) => (
              <div key={prediction.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-mono">
                    {prediction.target_date} · {prediction.target_session}
                  </span>
                  <span className="text-primary">{prediction.outcome ?? prediction.status}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  created {new Date(prediction.created_at).toLocaleString("en-GB")}
                </p>
              </div>
            ))}
            {predictions.length === 0 && (
              <p className="text-sm text-muted-foreground">No prediction records returned.</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-muted-foreground">
        <strong className="text-amber-300">Security boundary:</strong> this dashboard uses the
        repository’s existing shared <code>ADMIN_API_KEY</code> gate for mutation functions. It is
        an operator control, not customer authentication or a Premium entitlement system.
      </div>
    </AppShell>
  );
}
