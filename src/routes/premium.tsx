import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  Crown,
  FileCode2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import {
  getCustomerDashboard,
  getPremiumWorkspace,
  saveCustomerFormula,
  claimEarlyBirdPremium,
  type PremiumWorkspace,
} from "@/lib/customer.functions";
import { getAccessContext } from "@/lib/customer.functions";
import {
  captureWorkspaceCountry,
  getPricingContext,
  getEarlyBirdStatus,
} from "@/lib/pricing.functions";
import { formatZar, PREMIUM_PLANS } from "@/lib/pricing";
import { supabase } from "@/integrations/supabase/client";
import { Ball } from "@/components/AppShell";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Lotto IQ — Premium Workspace" },
      { name: "description", content: "Premium analysis workspace for Lotto IQ." },
    ],
  }),
  component: PremiumPage,
});

function PremiumPage() {
  const liveRefreshMs = 30_000;
  const queryClient = useQueryClient();
  const [formulaName, setFormulaName] = useState("");
  const [formulaExpression, setFormulaExpression] = useState("");
  const [saving, setSaving] = useState(false);
  const session = useQuery({
    queryKey: ["browser-session"],
    queryFn: async () => {
      const result = await supabase.auth.getSession();
      if (result.error) throw result.error;
      return result.data.session;
    },
    enabled: typeof window !== "undefined",
  });
  const access = useQuery({
    queryKey: ["access-context"],
    queryFn: () => getAccessContext(),
    enabled: Boolean(session.data),
  });
  const premium = useQuery({
    queryKey: ["premium-workspace"],
    queryFn: () => getPremiumWorkspace(),
    enabled: access.data?.role === "premium" || access.data?.role === "administrator",
    refetchInterval: liveRefreshMs,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const dashboard = useQuery({
    queryKey: ["customer-dashboard"],
    queryFn: () => getCustomerDashboard(),
    enabled: access.data?.role === "premium" || access.data?.role === "administrator",
    refetchInterval: liveRefreshMs,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const pricing = useQuery({ queryKey: ["pricing-context"], queryFn: () => getPricingContext() });

  const saveFormula = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveCustomerFormula({ data: { name: formulaName, expression: formulaExpression } });
      setFormulaName("");
      setFormulaExpression("");
      await queryClient.invalidateQueries({ queryKey: ["customer-dashboard"] });
      toast.success("Private Premium formula saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Formula could not be saved");
    } finally {
      setSaving(false);
    }
  };

  if (session.isLoading || (session.data && access.isLoading))
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    );
  if (session.error || access.error)
    return (
      <PageShell>
        <UpgradeState
          signedIn={Boolean(session.data)}
          title="Premium access could not be verified"
          detail="Refresh the page or return to secure account access before trying again."
        />
      </PageShell>
    );
  if (
    !session.data ||
    !access.data ||
    (access.data.role !== "premium" && access.data.role !== "administrator")
  )
    return (
      <PageShell>
        <UpgradeState signedIn={Boolean(session.data)} />
      </PageShell>
    );
  const workspace = premium.data;
  const prediction = workspace?.prediction;

  return (
    <PageShell>
      <header className="mb-7 flex flex-col justify-between gap-5 rounded-3xl border border-primary/25 bg-primary/10 p-6 sm:flex-row sm:items-end sm:p-8">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Crown className="size-4" /> Premium workspace · Lotto IQ Team
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            More signal. One private workspace.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            Your Premium entitlement unlocks the stored ensemble snapshot, analysis wheel, ranked
            candidates, one banker signal, and five private formulas. Results remain historical
            analysis and do not guarantee future outcomes.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          <ShieldCheck className="size-4" /> No advertisements
        </div>
      </header>

      <PremiumSessionGrid
        sessions={workspace?.sessions ?? []}
        currentDate={workspace?.currentDate}
      />

      <section className="mb-6 rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Premium access plans
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">Choose your renewal period</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              All plans renew automatically until cancelled. South African Rand is the
              source-of-truth billing currency.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Country:{" "}
            <span className="font-semibold text-foreground">
              {pricing.data?.countryCode ?? "…"}
            </span>
            {pricing.data?.countrySource === "edge" ? " · detected at edge" : " · defaulted safely"}
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PREMIUM_PLANS.map((plan, index) => (
            <div
              key={plan.code}
              className={`relative rounded-2xl border p-5 ${index === 1 ? "border-primary/45 bg-primary/10" : "border-border/60 bg-background/20"}`}
            >
              {index === 1 && (
                <span className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  Popular
                </span>
              )}
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {plan.label}
              </p>
              <p className="mt-3 font-display text-3xl font-bold">
                {formatZar(plan.priceZarMinor)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {plan.intervalLabel} · auto-renewing
              </p>
              {plan.discountPercent > 0 && (
                <p className="mt-3 inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                  {plan.discountPercent}% annual discount
                </p>
              )}
              <button
                disabled
                className="mt-5 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-xs font-semibold text-muted-foreground"
              >
                <LockKeyhole className="size-3.5" /> Checkout pending provider
              </button>
            </div>
          ))}
        </div>
        {pricing.data?.countryCode !== "ZA" && (
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            <strong className="text-foreground">International visitor:</strong> prices are shown in
            ZAR. Live exchange-rate conversion is not displayed until a verified FX or payment
            provider is connected; no guessed local amount is shown.
          </p>
        )}
      </section>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Target}
          label="Highly rated banker"
          value={workspace?.banker ? String(workspace.banker).padStart(2, "0") : "—"}
          detail="Latest verified prediction"
        />
        <MetricCard
          icon={Sparkles}
          label="14-ball pool"
          value={prediction?.pool.length ? String(prediction.pool.length) : "—"}
          detail={
            prediction
              ? `${prediction.targetDate} · ${prediction.targetSession}`
              : "No stored prediction"
          }
        />
        <MetricCard
          icon={BarChart3}
          label="Ensemble candidates"
          value={workspace?.ensemble?.candidates.length.toString() ?? "—"}
          detail={`${workspace?.ensemble?.strategyCount ?? 0} stored strategy signals`}
        />
        <MetricCard
          icon={FileCode2}
          label="Private formula capacity"
          value={`${dashboard.data?.formulas.length ?? 0}/5`}
          detail="Workspace-only storage"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-7">
          <SectionHeading
            icon={Sparkles}
            title="Ensemble analysis"
            subtitle="The latest stored snapshot, projected into Premium-safe fields."
          />
          {workspace?.ensemble ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {workspace.ensemble.candidates.slice(0, 8).map((candidate, index) => (
                <div
                  key={candidate.number}
                  className={`rounded-2xl border p-4 ${index === 0 ? "border-primary/40 bg-primary/10" : "border-border/60 bg-background/20"}`}
                >
                  <div className="flex items-center justify-between">
                    <Ball n={candidate.number} className="!size-10 !text-sm" />
                    <span className="text-xs text-primary">rank {index + 1}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>score {candidate.score.toFixed(2)}</span>
                    <span>{candidate.agreement} agreements</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, Math.max(0, candidate.score * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No stored ensemble snapshot is available yet." />
          )}
        </section>
        <section className="rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-7">
          <SectionHeading
            icon={Zap}
            title="Analysis wheel"
            subtitle="Premium ranking view from the latest stored run."
          />
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
            <img
              src="/lotto-iq-dream-wheel.jpg"
              alt="Lotto IQ UK 49s Dream Wheel"
              className="mx-auto aspect-square w-full max-w-xs rounded-2xl border border-border/60 object-cover"
            />
            <div className="grid grid-cols-7 gap-2">
              {(workspace?.wheel ?? []).map((item) => (
                <Ball
                  key={item.number}
                  n={item.number}
                  className="!size-10 !text-sm"
                  title={`Score ${item.score.toFixed(2)} · agreement ${item.agreement}`}
                />
              ))}
            </div>
          </div>
          {!workspace?.wheel.length && (
            <EmptyState label="The wheel will populate after the next stored analysis run." />
          )}
          <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-5 text-muted-foreground">
            <strong className="text-primary">Responsible-use note:</strong> ranking is an analytical
            signal, not a prediction guarantee.
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-7">
          <SectionHeading
            icon={Target}
            title="Banker and 7-ball ranking"
            subtitle="The latest prediction projection available to your Premium workspace."
          />
          {prediction ? (
            <>
              <div className="mt-6 flex items-center gap-3">
                {workspace?.banker ? (
                  <Ball
                    n={workspace.banker}
                    variant="primary"
                    className="!size-16 !rounded-2xl !text-xl"
                  />
                ) : (
                  <div className="grid size-16 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
                    —
                  </div>
                )}
                <div>
                  <p className="font-semibold">Highly rated banker</p>
                  <p className="text-xs text-muted-foreground">
                    {prediction.status} · {prediction.targetDate} · {prediction.targetSession}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {prediction.ranking.map((number, index) => (
                  <Ball
                    key={`${number}-${index}`}
                    n={number}
                    className="!size-9 !text-xs"
                    title={`Rank ${index + 1} · UK49 number ${number}`}
                  />
                ))}
              </div>
            </>
          ) : (
            <EmptyState label="No prediction is currently stored for Premium projection." />
          )}
        </section>
        <section className="rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-7">
          <SectionHeading
            icon={FileCode2}
            title="Private formula vault"
            subtitle="Premium workspaces can store up to five formulas. Only your workspace can read them."
          />
          <form onSubmit={saveFormula} className="mt-5 grid gap-3 sm:grid-cols-[.7fr_1.3fr_auto]">
            <input
              required
              minLength={2}
              maxLength={120}
              value={formulaName}
              onChange={(event) => setFormulaName(event.target.value)}
              placeholder="Formula name"
              className="rounded-xl border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              required
              minLength={1}
              maxLength={4000}
              value={formulaExpression}
              onChange={(event) => setFormulaExpression(event.target.value)}
              placeholder="Private expression"
              className="rounded-xl border border-border bg-background/70 px-3 py-2.5 font-mono text-xs outline-none focus:border-primary"
            />
            <button
              disabled={saving}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
          <div className="mt-5 space-y-2">
            {(dashboard.data?.formulas ?? []).map((formula) => (
              <div
                key={formula.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/20 px-3 py-3 text-sm"
              >
                <span className="font-semibold">{formula.name}</span>
                <span className="max-w-[55%] truncate font-mono text-xs text-muted-foreground">
                  {formula.expression}
                </span>
              </div>
            ))}
            {!dashboard.data?.formulas.length && (
              <EmptyState label="No private formulas saved yet." />
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 rounded-2xl border border-border/60 bg-background/20 p-4 text-xs leading-5 text-muted-foreground">
        <strong className="text-foreground">Visibility boundary:</strong> Premium access exposes the
        projected ensemble, wheel, ranking, and banker fields only. It does not expose global
        strategy definitions, the Ledger, other client workspaces, or another client's formulas.
      </div>
    </PageShell>
  );
}

type PremiumSession = PremiumWorkspace["sessions"][number];

function PremiumSessionGrid({
  sessions,
  currentDate,
}: {
  sessions: PremiumSession[];
  currentDate: string | null | undefined;
}) {
  const current = sessions.filter((session) => session.targetDate === currentDate);
  const order = [
    ["brunch", "Brunch"],
    ["lunch", "Lunch"],
    ["drivetime", "Drive Time"],
    ["teatime", "Tea Time"],
  ] as const;
  return (
    <section className="mb-6 rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Live ensemble schedule
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold">
            Full ensemble from Brunch to Tea Time
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {currentDate ?? "Awaiting draw schedule"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Brunch and Lunch share the same locked live numbers. Drive Time and Tea Time receive their
        own refreshed ensemble when their draw window is reached.
      </p>
      <div className="mt-5 grid gap-4 xl:grid-cols-4">
        {order.map(([key, label]) => {
          const session = current.find((item) => item.targetSession === key);
          const matchedNumbers = new Set(session?.actualNumbers ?? []);
          return (
            <div key={key} className="rounded-2xl border border-border/60 bg-background/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{label}</h3>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {session?.status ?? "waiting"}
                </span>
              </div>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-primary">
                Prediction pool
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {session?.pool.map((number) => (
                  <Ball
                    key={number}
                    n={number}
                    variant={matchedNumbers.has(number) ? "matched" : "default"}
                  />
                )) ?? <span className="text-xs text-muted-foreground">Not published yet.</span>}
              </div>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                Full ensemble
              </p>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {session?.ensemble?.candidates.map((candidate) => (
                  <Ball
                    key={candidate.number}
                    n={candidate.number}
                    variant={matchedNumbers.has(candidate.number) ? "matched" : "default"}
                    className="!size-8 !text-[10px]"
                    title={`Score ${candidate.score.toFixed(2)} · agreement ${candidate.agreement}`}
                  />
                ))}
              </div>
              {session?.actualNumbers.length ? (
                <div className="mt-4 border-t border-border/60 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    Winning numbers
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {session.actualNumbers.map((number) => (
                      <Ball
                        key={number}
                        n={number}
                        variant={session.pool.includes(number) ? "matched" : "accent"}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {session.matchedCount} predicted matches
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <nav className="mb-8 flex items-center justify-between">
          <Link to="/dashboard" className="font-display text-lg font-bold">
            Lotto <span className="gradient-text">IQ</span>
          </Link>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Back to dashboard <ArrowRight className="ml-1 inline size-3" />
          </Link>
        </nav>
        {children}
      </div>
    </main>
  );
}
function LoadingState() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">
      Loading Premium workspace…
    </div>
  );
}
function UpgradeState({
  signedIn,
  title = "Premium workspace access",
  detail,
}: {
  signedIn: boolean;
  title?: string;
  detail?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-primary/20 bg-primary/10 p-8 text-center sm:p-12">
      <LockKeyhole className="mx-auto size-10 text-primary" />
      <h1 className="mt-5 font-display text-3xl font-bold">{title}</h1>
      <p className="mt-3 leading-7 text-muted-foreground">
        {detail ??
          (signedIn
            ? "Your account is currently on the Free plan. Premium analysis becomes available after a verified entitlement is active."
            : "Sign in to view your membership and Premium access state.")}
      </p>
      <Link
        to={signedIn ? "/premium" : "/account"}
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
      >
        {signedIn ? "Refresh membership" : "Sign in or create account"}{" "}
        <ArrowRight className="size-4" />
      </Link>
      {signedIn && <EarlyBirdClaim />}
    </div>
  );
}

function EarlyBirdClaim() {
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  const status = useQuery({
    queryKey: ["early-bird-status"],
    queryFn: () => getEarlyBirdStatus(),
  });

  const claim = async () => {
    setClaiming(true);
    try {
      await captureWorkspaceCountry();
      const result = await claimEarlyBirdPremium();
      if (result.alreadyClaimed) {
        toast.success("You already claimed early-bird Premium.");
      } else {
        toast.success("Early-bird Premium claimed — welcome aboard!");
      }
      await queryClient.invalidateQueries({ queryKey: ["access-context"] });
      await queryClient.invalidateQueries({ queryKey: ["early-bird-status"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not claim early-bird Premium");
    } finally {
      setClaiming(false);
    }
  };

  if (status.isLoading) return null;
  const remaining = status.data?.remaining ?? 0;
  if (remaining <= 0 || status.data?.enabled !== true) return null;

  return (
    <div className="mt-8 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5 text-left">
      <div className="flex items-center gap-2 text-emerald-300">
        <Sparkles className="size-4" />
        <p className="text-xs font-bold uppercase tracking-widest">Early-bird — 100% off</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        The first 1,000 clients may claim full Premium access at no cost during the 30-day beta
        window. No card, no checkout — one click. Your normal Free dashboard remains available
        without claiming this offer.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{remaining}</span> of{" "}
        {status.data?.limit ?? 1000} spots remaining
      </p>
      <button
        onClick={claim}
        disabled={claiming}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 disabled:opacity-60"
      >
        {claiming ? "Claiming…" : "Claim free Premium"}
      </button>
    </div>
  );
}
function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Activity;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
function MetricCard({
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
    <div className="rounded-2xl border border-border/70 bg-card/30 p-5">
      <Icon className="size-4 text-primary" />
      <p className="mt-4 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}
function EmptyState({ label }: { label: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
