import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Ball, Panel } from "@/components/AppShell";
import { SyncLog } from "@/components/SyncLog";
import { SyncPanel } from "@/components/SyncPanel";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Database,
  Gauge,
  Globe2,
  Library,
  LockKeyhole,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { getAccessContext } from "@/lib/customer.functions";
import { getCapacityMetrics } from "@/lib/capacity.functions";
import { getGeographyAnalytics } from "@/lib/geography.functions";
import { getSecurityOverview, setAccountAccess } from "@/lib/security.functions";
import { listResearchReportsFn, triggerResearchNow } from "@/lib/research.functions";
import { buildPrediction } from "@/lib/predict";
import { computeStats } from "@/lib/stats";
import { buildEnsemble } from "@/lib/ensemble";
import { currentSession, type Draw, type Strategy } from "@/lib/uk49";
import { getEarlyBirdStatus } from "@/lib/pricing.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Lotto IQ — Admin Operations" },
      {
        name: "description",
        content: "Lotto IQ administrator dashboard for data and analysis operations.",
      },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const session = useQuery({
    queryKey: ["browser-session"],
    queryFn: async () => {
      const result = await supabase.auth.getSession();
      if (result.error) throw result.error;
      return result.data.session;
    },
    enabled: typeof window !== "undefined",
  });
  const {
    data: access,
    isLoading: accessLoading,
    error: accessError,
  } = useQuery({
    queryKey: ["access-context"],
    queryFn: () => getAccessContext(),
    enabled: Boolean(session.data),
  });
  const isAdministrator = access?.role === "administrator";

  const {
    data: capacity,
    isLoading: capacityLoading,
    error: capacityError,
  } = useQuery({
    queryKey: ["admin", "capacity"],
    queryFn: () => getCapacityMetrics(),
    refetchInterval: 60_000,
    enabled: isAdministrator,
  });

  const {
    data: security,
    isLoading: securityLoading,
    error: securityError,
    refetch: refetchSecurity,
  } = useQuery({
    queryKey: ["admin", "security"],
    queryFn: () => getSecurityOverview(),
    refetchInterval: 60_000,
    enabled: isAdministrator,
  });

  const { data: earlyBird } = useQuery({
    queryKey: ["admin", "early-bird"],
    queryFn: () => getEarlyBirdStatus(),
    refetchInterval: 30_000,
    enabled: isAdministrator,
  });

  const {
    data: geography,
    isLoading: geographyLoading,
    error: geographyError,
  } = useQuery({
    queryKey: ["admin", "geography"],
    queryFn: () => getGeographyAnalytics(),
    refetchInterval: 5 * 60_000,
    enabled: isAdministrator,
  });

  const { data: draws = [], isLoading: drawsLoading } = useQuery({
    queryKey: ["admin", "draws-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("draws")
        .select("*")
        .order("draw_date", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as unknown as Draw[];
    },
    refetchInterval: 30_000,
    enabled: isAdministrator,
  });

  const { data: strategies = [], isLoading: strategiesLoading } = useQuery({
    queryKey: ["admin", "strategies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategies")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Strategy[];
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

  const [targetUserId, setTargetUserId] = useState("");
  const [accessReason, setAccessReason] = useState("");
  const [accessActionPending, setAccessActionPending] = useState(false);
  const [researchPending, setResearchPending] = useState(false);

  const {
    data: researchReports = [],
    isLoading: researchLoading,
    refetch: refetchResearch,
  } = useQuery({
    queryKey: ["research-reports"],
    queryFn: () => listResearchReportsFn(),
    enabled: isAdministrator,
  });

  const activeStrategies = strategies.filter((strategy) => strategy.enabled);
  const liveTargetDate = new Date().toISOString().slice(0, 10);
  const liveTargetSession = currentSession();
  const liveHistory = draws as Draw[];
  const livePrediction = useMemo(
    () =>
      buildPrediction(activeStrategies, {
        targetDate: liveTargetDate,
        targetSession: liveTargetSession,
        history: liveHistory,
      }),
    [activeStrategies, liveHistory, liveTargetDate, liveTargetSession],
  );
  const liveStats = useMemo(() => computeStats(liveHistory, { simulations: 500 }), [liveHistory]);
  const liveEnsemble = useMemo(
    () => buildEnsemble(livePrediction, liveStats, 0.7),
    [livePrediction, liveStats],
  );

  if (session.isLoading || (session.data && accessLoading))
    return (
      <AppShell>
        <div className="py-20 text-center text-sm text-muted-foreground">
          Checking administrator access…
        </div>
      </AppShell>
    );
  if (session.error || accessError || !session.data || !isAdministrator)
    return (
      <AppShell>
        <div className="mx-auto max-w-lg py-20 text-center">
          <LockKeyhole className="mx-auto size-10 text-destructive" />
          <h1 className="mt-5 font-display text-2xl font-bold">
            {session.error || accessError
              ? "Administrator access could not be verified"
              : "Administrator access required"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {session.data
              ? "This is a protected operator console. Your customer account cannot read platform operations or private strategy definitions."
              : "Sign in with an allowlisted administrator account to open the Lotto IQ administrator console."}
          </p>
          {!session.data && (
            <Link
              to="/account"
              className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Open secure account access
            </Link>
          )}
        </div>
      </AppShell>
    );

  const activeStrategyCount = activeStrategies.length;
  const gradedPredictions = predictions.filter((prediction) => prediction.outcome != null).length;
  const activeEstimate = capacity?.current.active_users_estimate ?? 0;
  const capacityPercent = capacity?.current.capacity_percent ?? 0;
  const alertLevel = capacity?.current.alert_level ?? "normal";
  const updateAccountAccess = async (status: "active" | "suspended" | "revoked") => {
    setAccessActionPending(true);
    try {
      await setAccountAccess({
        data: { userId: targetUserId.trim(), status, reason: accessReason },
      });
      toast.success(
        status === "active" ? "Client access restored." : `Client access marked ${status}.`,
      );
      setAccessReason("");
      await refetchSecurity();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Security action failed");
    } finally {
      setAccessActionPending(false);
    }
  };

  const runResearchNow = async () => {
    setResearchPending(true);
    try {
      await triggerResearchNow();
      toast.success("Research run started.");
      await refetchResearch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Research trigger failed");
    } finally {
      setResearchPending(false);
    }
  };

  const stats = [
    {
      label: "Draw rows sampled",
      value: drawsLoading ? "…" : draws.length >= 1000 ? "1,000+" : draws.length,
      icon: Database,
    },
    {
      label: "Active strategies",
      value: strategiesLoading ? "…" : activeStrategyCount,
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
            <ShieldCheck className="size-4" /> Lotto IQ Team
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold">Admin dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Monitor Lotto IQ data freshness, capacity, account activity, access controls, ingestion
            runs, and prediction ledger activity.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
          <LockKeyhole className="size-4 text-primary" />
          Protected administrator session
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

      <section className="mb-6 rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Activity className="size-4" /> Live product engines
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold">
              Analysis, ensemble, and statistics
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              These panels run the same current draw history and enabled strategies as the product
              routes. They are read-only operator views and refresh with the live source data.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {liveTargetDate} · {liveTargetSession} · {liveHistory.length} draws
          </span>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <Panel title="Live analysis">
            <p className="text-xs text-muted-foreground">Top formula candidates</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {livePrediction.pool.slice(0, 10).map((candidate, index) => (
                <div key={candidate.n} className="text-center">
                  <Ball n={candidate.n} variant={index === 0 ? "primary" : "accent"} />
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {candidate.score}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Banker:{" "}
              <strong className="font-mono text-foreground">
                {livePrediction.bankers[0]?.n ?? "—"}
              </strong>
              {" · "}
              {livePrediction.strategy_count} active strategies
            </p>
          </Panel>
          <Panel title="Live ensemble">
            <p className="text-xs text-muted-foreground">Formula 70% · statistics 30%</p>
            <p className="mt-3 font-display text-3xl font-bold">
              {liveEnsemble.banker.banker?.n ?? "—"}
            </p>
            <p className="mt-1 text-xs font-semibold text-primary">{liveEnsemble.banker.status}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
              {(Object.keys(liveEnsemble.counts) as Array<keyof typeof liveEnsemble.counts>).map(
                (classification) => (
                  <span
                    key={classification}
                    className="rounded border border-border/70 px-2 py-1 text-muted-foreground"
                  >
                    {classification}: {liveEnsemble.counts[classification]}
                  </span>
                ),
              )}
            </div>
          </Panel>
          <Panel title="Live statistics">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Sample {liveStats.sample}</span>
              <span>Entropy {(liveStats.entropy.ratio * 100).toFixed(1)}%</span>
            </div>
            <div className="mt-3 space-y-2">
              {liveStats.numbers.slice(0, 6).map((number) => (
                <div key={number.n} className="flex items-center gap-2 text-xs">
                  <Ball n={number.n} className="size-7 text-[11px]" />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary/70">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${number.score * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-muted-foreground">
                    #{number.rank}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Library className="size-4" /> Product directory
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold">All live product surfaces</h2>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>No payment gate in Early Bird test</p>
            <p className="mt-1 font-mono text-primary">
              {earlyBird
                ? `${earlyBird.claimed}/${earlyBird.limit} registered · ${earlyBird.remaining} remaining`
                : "Loading tester capacity…"}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Client dashboard", "/dashboard"],
            ["Analysis engine", "/analysis"],
            ["Ensemble confirmation", "/ensemble"],
            ["Strategy manager", "/strategies"],
            ["Draw workflow", "/draws"],
            ["Prediction ledger", "/history"],
            ["Backtest lab", "/backtest"],
            ["Research reports", "/research"],
            ["Russia lottery module", "/russia"],
            ["Structure tools", "/structure"],
            ["Notifications", "/notifications"],
            ["Premium workspace", "/premium"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="rounded-xl border border-border/60 bg-background/20 px-3 py-3 text-sm font-semibold hover:border-primary/50 hover:text-primary"
            >
              {label}
            </a>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Gauge className="size-4" /> Capacity watch
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold">Live system load</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              The estimate counts active browser clients from a low-overhead minute heartbeat. No
              names, emails, IP addresses, or page trails are stored.
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-semibold ${alertLevel === "critical" ? "border-red-400/30 bg-red-400/10 text-red-300" : alertLevel === "warning" ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"}`}
          >
            {alertLevel === "normal" ? (
              <Activity className="size-3.5" />
            ) : (
              <AlertTriangle className="size-3.5" />
            )}
            {capacityLoading
              ? "Checking"
              : alertLevel === "normal"
                ? "Within planned capacity"
                : alertLevel === "warning"
                  ? "Approaching capacity"
                  : "Critical capacity"}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <CapacityCard
            icon={Users}
            label="Active client estimate"
            value={capacityLoading ? "…" : activeEstimate.toLocaleString("en-GB")}
            detail={`soft limit ${capacity?.config.active_user_soft_limit.toLocaleString("en-GB") ?? "—"}`}
          />
          <CapacityCard
            icon={Gauge}
            label="Capacity used"
            value={capacityLoading ? "…" : `${capacityPercent.toFixed(1)}%`}
            detail={`warning at ${capacity?.config.alert_percent ?? "—"}% · critical at ${capacity?.config.critical_percent ?? "—"}%`}
          />
          <CapacityCard
            icon={Clock3}
            label="Current minute"
            value={capacityLoading ? "…" : `${capacity?.current.average_latency_ms ?? 0} ms`}
            detail={`${capacity?.current.requests ?? 0} requests · ${capacity?.current.errors ?? 0} errors`}
          />
        </div>
        <div
          className="mt-5 h-3 overflow-hidden rounded-full bg-secondary/70"
          aria-label={`Capacity usage ${capacityPercent.toFixed(1)} percent`}
        >
          <div
            className={`h-full rounded-full transition-all ${alertLevel === "critical" ? "bg-red-400" : alertLevel === "warning" ? "bg-amber-400" : "bg-primary"}`}
            style={{ width: `${Math.min(100, capacityPercent)}%` }}
          />
        </div>
        {capacityError && (
          <p className="mt-3 text-xs text-amber-300">
            Capacity metrics are temporarily unavailable; customer traffic is not blocked.
          </p>
        )}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Busy periods · last 7 days
              </h3>
              <span className="text-xs text-muted-foreground">hour of day</span>
            </div>
            <div className="space-y-2">
              {(capacity?.busy_periods ?? []).slice(0, 5).map((period) => (
                <div key={period.hour_of_day} className="flex items-center gap-3 text-xs">
                  <span className="w-16 font-mono text-muted-foreground">
                    {String(period.hour_of_day).padStart(2, "0")}:00
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary/70">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{
                        width: `${Math.min(100, capacity && capacity.config.active_user_soft_limit ? (period.peak_active_users_estimate / capacity.config.active_user_soft_limit) * 100 : 0)}%`,
                      }}
                    />
                  </div>
                  <span className="w-20 text-right text-muted-foreground">
                    {period.peak_active_users_estimate.toLocaleString("en-GB")}
                  </span>
                </div>
              ))}
              {!capacity?.busy_periods.length && (
                <p className="text-sm text-muted-foreground">
                  Busy-period history will appear after telemetry accumulates.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/20 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Upgrade signal
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The configured soft limit is currently{" "}
              {capacity?.config.active_user_soft_limit.toLocaleString("en-GB") ?? "10,000"} active
              clients. Review the database and Supabase plan before the warning line becomes
              routine.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-primary">
              <ShieldCheck className="size-4" /> Pre-capacity alerting enabled
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Globe2 className="size-4" /> Geographic distribution
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold">Client workspaces by country</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Aggregated country counts from workspace billing metadata. No names, emails, IP
              addresses, or individual location trails are displayed here.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Total workspaces</p>
            <p className="mt-1 font-mono text-primary">
              {geographyLoading ? "…" : (geography?.totalWorkspaces.toLocaleString("en-GB") ?? "—")}
            </p>
          </div>
        </div>
        {geographyError ? (
          <p className="mt-5 text-xs text-amber-300">
            Geographic analytics are temporarily unavailable.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(geography?.countries ?? []).slice(0, 12).map((country) => (
              <div
                key={country.countryCode}
                className="rounded-2xl border border-border/60 bg-background/20 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-semibold text-primary">
                    {country.countryCode}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {country.workspaces} workspaces
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary/70">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, geography?.totalWorkspaces ? (country.workspaces / geography.totalWorkspaces) * 100 : 0)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {country.activePremium} active Premium
                </p>
              </div>
            ))}
            {!geographyLoading && !geography?.countries.length && (
              <p className="text-sm text-muted-foreground">
                Country distribution will appear after workspace metadata is recorded.
              </p>
            )}
          </div>
        )}
        {geography && geography.unknownCountryWorkspaces > 0 && (
          <p className="mt-4 text-[11px] text-muted-foreground">
            {geography.unknownCountryWorkspaces} workspace
            {geography.unknownCountryWorkspaces === 1 ? "" : "s"} have no country metadata and are
            grouped as ZZ.
          </p>
        )}
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <ShieldCheck className="size-4" /> Security controls
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold">Account access settings</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Suspend or revoke a client without seeing their password. The action is audited and
            takes effect on the next protected request.
          </p>
          <label className="mt-5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Client user ID
            <input
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
              placeholder="Supabase UUID"
              className="mt-2 w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 font-mono text-xs outline-none focus:border-primary"
            />
          </label>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Reason
            <textarea
              value={accessReason}
              onChange={(event) => setAccessReason(event.target.value)}
              maxLength={240}
              placeholder="Document the security or support reason"
              className="mt-2 min-h-20 w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              disabled={accessActionPending || !targetUserId.trim()}
              onClick={() => void updateAccountAccess("suspended")}
              className="rounded-xl border border-amber-400/30 px-3 py-2 text-xs font-semibold text-amber-300 disabled:opacity-50"
            >
              Suspend
            </button>
            <button
              disabled={accessActionPending || !targetUserId.trim()}
              onClick={() => void updateAccountAccess("revoked")}
              className="rounded-xl border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-50"
            >
              Revoke access
            </button>
            <button
              disabled={accessActionPending || !targetUserId.trim()}
              onClick={() => void updateAccountAccess("active")}
              className="rounded-xl border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-50"
            >
              Restore
            </button>
          </div>
          <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
            Password reset remains a Supabase Auth recovery flow. Administrators never receive or
            store a client password.
          </p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Users className="size-4" /> Account and audit summary
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SecurityStat
              label="Registered"
              value={
                securityLoading
                  ? "…"
                  : (security?.accounts.registered.toLocaleString("en-GB") ?? "—")
              }
            />
            <SecurityStat
              label="Confirmed"
              value={
                securityLoading
                  ? "…"
                  : (security?.accounts.confirmed.toLocaleString("en-GB") ?? "—")
              }
            />
            <SecurityStat
              label="New · 24h"
              value={
                securityLoading
                  ? "…"
                  : (security?.accounts.created_last_24h.toLocaleString("en-GB") ?? "—")
              }
            />
            <SecurityStat
              label="Controlled"
              value={
                securityLoading
                  ? "…"
                  : (security?.accounts.controlled.toLocaleString("en-GB") ?? "—")
              }
            />
          </div>
          {securityError && (
            <p className="mt-4 text-xs text-amber-300">
              Security overview is temporarily unavailable.
            </p>
          )}
          <h3 className="mt-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Recent access controls
          </h3>
          <div className="mt-3 space-y-2">
            {(security?.controls ?? []).slice(0, 6).map((control) => (
              <div
                key={control.user_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-xs"
              >
                <span className="min-w-0 truncate font-mono text-muted-foreground">
                  {control.user_id}
                </span>
                <span
                  className={
                    control.status === "revoked"
                      ? "text-red-300"
                      : control.status === "suspended"
                        ? "text-amber-300"
                        : "text-emerald-300"
                  }
                >
                  {control.status}
                </span>
              </div>
            ))}
            {!securityLoading && !security?.controls.length && (
              <p className="text-sm text-muted-foreground">No suspended or revoked accounts.</p>
            )}
          </div>
          <h3 className="mt-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Recent administrator actions
          </h3>
          <div className="mt-3 space-y-2">
            {(security?.audit ?? []).slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-xs"
              >
                <span className="text-muted-foreground">{entry.action.replaceAll("_", " ")}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString("en-GB")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

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
                  <th className="pb-2">Rule type</th>
                  <th className="pb-2">Rule</th>
                  <th className="pb-2">State</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((strategy) => (
                  <tr key={strategy.id} className="border-t border-border/60">
                    <td className="py-2 font-medium">{strategy.name}</td>
                    <td className="py-2 text-muted-foreground">{strategy.rule_type}</td>
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

      <Panel
        title="Lotto IQ research"
        className="mt-6"
        action={
          <button
            onClick={runResearchNow}
            disabled={researchPending}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {researchPending ? "Starting…" : "Run now"}
          </button>
        }
      >
        <div className="space-y-3">
          {researchLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {researchReports.map((report: Record<string, unknown>) => (
            <div key={String(report["id"])} className="rounded-xl border border-border/70 p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-mono text-muted-foreground">
                  {new Date(String(report["created_at"])).toLocaleString("en-GB")}
                </span>
                <span
                  className={
                    report["status"] === "completed"
                      ? "text-emerald-400"
                      : report["status"] === "failed"
                        ? "text-red-400"
                        : "text-amber-400"
                  }
                >
                  {String(report["status"])}
                </span>
              </div>
              {typeof report["error"] === "string" && report["error"] && (
                <p className="mt-1 text-[11px] text-red-400">{report["error"]}</p>
              )}
            </div>
          ))}
          {!researchLoading && researchReports.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No research runs yet — use "Run now" to start one.
            </p>
          )}
        </div>
      </Panel>

      <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-muted-foreground">
        <strong className="text-amber-300">Security boundary:</strong> password values are never
        visible here. Account access changes require the administrator allowlist and are written to
        the protected audit log.
      </div>
    </AppShell>
  );
}

function CapacityCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/20 p-4">
      <Icon className="size-4 text-primary" />
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function SecurityStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/20 p-3">
      <p className="font-display text-xl font-bold">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
