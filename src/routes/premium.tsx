import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  type PremiumCandidate,
  type PremiumWorkspace,
} from "@/lib/customer.functions";
import { getAccessContext } from "@/lib/customer.functions";
import {
  captureWorkspaceCountry,
  getPricingContext,
  getEarlyBirdStatus,
  registerPremiumBetaInterest,
} from "@/lib/pricing.functions";
import { formatZar, PREMIUM_PLAN } from "@/lib/pricing";
import { supabase } from "@/integrations/supabase/client";
import { Ball } from "@/components/AppShell";
import { memberDisplayName } from "@/lib/member-name";

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
  const prediction = workspace?.prediction ?? null;
  const memberName = memberDisplayName(session.data.user);

  return (
    <PageShell>
      <header className="mb-7 flex flex-col justify-between gap-5 rounded-3xl border border-primary/25 bg-primary/10 p-6 sm:flex-row sm:items-end sm:p-8">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Crown className="size-4" /> Premium workspace · Lotto IQ Team
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Welcome, {memberName}.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            Your Premium membership puts the original Lotto IQ scoring engine in one clear view:
            today’s prediction, three highly rated bankers, five ranked balls, the complete ensemble
            analysis, full wheel structure, and the scorecard behind each signal. These are
            analytical signals, not a guarantee of any outcome.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          <ShieldCheck className="size-4" /> No advertisements
        </div>
      </header>

      <PremiumTodayPrediction prediction={prediction} ensemble={workspace?.ensemble ?? null} />
      <PremiumEnsembleAnalysis ensemble={workspace?.ensemble ?? null} />
      <PremiumWheelStructure wheel={workspace?.wheel ?? []} />
      <PremiumAnalysisScoring ensemble={workspace?.ensemble ?? null} />

      <PremiumBenefits />

      <PremiumSessionGrid
        sessions={workspace?.sessions ?? []}
        currentDate={workspace?.currentDate}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <PremiumSubscription countryCode={pricing.data?.countryCode} />
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
        stored ranking, ensemble score, agreement count, and wheel only. It does not expose global
        strategy definitions, the Ledger, other client workspaces, or another client’s formulas.
      </div>
    </PageShell>
  );
}

function PremiumTodayPrediction({
  prediction,
  ensemble,
}: {
  prediction: PremiumWorkspace["prediction"];
  ensemble: PremiumWorkspace["ensemble"];
}) {
  const topRated = prediction?.bankers.length
    ? prediction.bankers.slice(0, 3)
    : (ensemble?.candidates.slice(0, 3) ?? []);
  const ranking = prediction?.rankedBalls.length
    ? prediction.rankedBalls.slice(0, 5)
    : (ensemble?.candidates.slice(0, 5) ?? []);
  return (
    <section className="rounded-3xl border border-primary/25 bg-primary/[0.04] p-5 shadow-sm sm:p-7">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Today’s prediction
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold">
            {prediction
              ? `${prediction.targetDate} · ${prediction.targetSession}`
              : "Awaiting the next scheduled prediction"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            The cards below are tied to the next UK49 review window. A previous session is never
            relabelled as today’s prediction.
          </p>
        </div>
        <span className="rounded-full border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary">
          {prediction?.status ?? "Not published"}
        </span>
      </div>

      {!prediction ? (
        <EmptyState label="Today’s Premium prediction has not been stored yet. The dashboard will show it after the scheduled analysis is saved." />
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-border/60 bg-background/20 p-5">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">3 highly rated bankers</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Highest weighted candidates from the original stored ensemble for this exact draw.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {topRated.map((candidate, index) => (
                <CandidateHighlight key={candidate.number} candidate={candidate} rank={index + 1} />
              ))}
              {!topRated.length && (
                <p className="text-sm text-muted-foreground">
                  Ensemble ratings are not stored for this draw yet.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/20 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">5 ranking balls</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              The five highest-ranked balls from the original scoring engine for this draw.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {ranking.map((candidate, index) => (
                <div key={`${candidate.number}-${index}`} className="text-center">
                  <Ball
                    n={candidate.number}
                    variant={index === 0 ? "primary" : "default"}
                    className="mx-auto !size-12 !text-sm"
                    title={`Ranking position ${index + 1} · score ${candidate.score.toFixed(2)}`}
                  />
                  <span className="mt-1 block text-[10px] text-muted-foreground">#{index + 1}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {candidate.score.toFixed(2)}
                  </span>
                </div>
              ))}
              {!ranking.length && (
                <p className="text-sm text-muted-foreground">No ranked balls are stored yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CandidateHighlight({ candidate, rank }: { candidate: PremiumCandidate; rank: number }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
        #{rank} rated
      </span>
      <Ball n={candidate.number} variant="primary" className="mx-auto mt-3 !size-12 !text-sm" />
      <p className="mt-3 text-sm font-semibold">Score {candidate.score.toFixed(2)}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {candidate.agreement} strategy {candidate.agreement === 1 ? "signal" : "signals"}
      </p>
    </div>
  );
}

function PremiumEnsembleAnalysis({ ensemble }: { ensemble: PremiumWorkspace["ensemble"] }) {
  const candidates = ensemble?.candidates ?? [];
  const maxScore = Math.max(...candidates.map((candidate) => candidate.score), 1);
  return (
    <section className="mt-6 rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-7">
      <SectionHeading
        icon={BarChart3}
        title="Full ensemble analysis"
        subtitle="The complete original stored ensemble, ranked by weighted strategy agreement for today’s scheduled draw."
      />
      {ensemble ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <EnsembleStat label="Stored candidates" value={String(candidates.length)} />
            <EnsembleStat label="Active strategies" value={String(ensemble.strategyCount)} />
            <EnsembleStat label="Snapshot saved" value={formatSnapshotDate(ensemble.createdAt)} />
          </div>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border/60 bg-background/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Ball</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Weighted score</th>
                  <th className="px-4 py-3">Agreement</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate, index) => (
                  <tr key={candidate.number} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-3">
                      <Ball n={candidate.number} variant={index < 3 ? "primary" : "default"} />
                    </td>
                    <td className="px-4 py-3">
                      <RatingBadge score={candidate.score} maxScore={maxScore} rank={index} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-40 items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.max(0, Math.min(100, (candidate.score / maxScore) * 100))}%`,
                            }}
                          />
                        </div>
                        <span className="w-12 text-right font-mono text-xs">
                          {candidate.score.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {candidate.agreement} strategy{" "}
                      {candidate.agreement === 1 ? "signal" : "signals"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState label="No original ensemble snapshot is stored for today’s scheduled draw yet." />
      )}
    </section>
  );
}

function RatingBadge({ score, maxScore, rank }: { score: number; maxScore: number; rank: number }) {
  const fraction = score / maxScore;
  const label =
    rank === 0 ? "Highest" : fraction >= 0.75 ? "High" : fraction >= 0.5 ? "Supporting" : "Signal";
  const className =
    label === "Highest"
      ? "border-primary/35 bg-primary/10 text-primary"
      : label === "High"
        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
        : "border-border/60 bg-background/30 text-muted-foreground";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function EnsembleStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/20 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatSnapshotDate(value: string) {
  const snapshot = new Date(value);
  if (Number.isNaN(snapshot.valueOf())) return "Unavailable";
  return snapshot.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PremiumWheelStructure({ wheel }: { wheel: PremiumWorkspace["wheel"] }) {
  return (
    <section className="mt-6 rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-7">
      <SectionHeading
        icon={Zap}
        title="Wheel structure"
        subtitle="Every stored wheel position is shown with its source score and agreement detail."
      />
      {wheel.length ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(16rem,.7fr)_minmax(0,1.3fr)] lg:items-start">
          <img
            src="/lotto-iq-dream-wheel.jpg"
            alt="Lotto IQ UK 49s Dream Wheel"
            className="mx-auto aspect-square w-full max-w-xs rounded-2xl border border-border/60 object-cover"
          />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {wheel.map((item, index) => (
              <div
                key={item.number}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/20 p-3"
              >
                <span className="w-5 text-xs text-muted-foreground">W{index + 1}</span>
                <Ball
                  n={item.number}
                  variant={index < 3 ? "primary" : "default"}
                  className="!size-9 !text-xs"
                  title={`Wheel ${index + 1}: score ${item.score.toFixed(2)}, ${item.agreement} strategy signals`}
                />
                <div className="min-w-0 text-xs">
                  <p className="font-semibold">{item.score.toFixed(2)} score</p>
                  <p className="mt-0.5 text-muted-foreground">{item.agreement} agreement</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState label="The wheel will populate after today’s stored analysis run is available." />
      )}
    </section>
  );
}

function PremiumAnalysisScoring({ ensemble }: { ensemble: PremiumWorkspace["ensemble"] }) {
  const candidates = ensemble?.candidates ?? [];
  const maxScore = Math.max(...candidates.map((candidate) => candidate.score), 0);
  const averageScore = candidates.length
    ? candidates.reduce((total, candidate) => total + candidate.score, 0) / candidates.length
    : 0;
  const averageAgreement = candidates.length
    ? candidates.reduce((total, candidate) => total + candidate.agreement, 0) / candidates.length
    : 0;
  const highSignalCount = candidates.filter(
    (candidate) => candidate.score >= maxScore * 0.75,
  ).length;
  return (
    <section className="mt-6 rounded-3xl border border-border/70 bg-card/30 p-5 sm:p-7">
      <SectionHeading
        icon={Target}
        title="Analysis scoring"
        subtitle="Transparent interpretation of the original weighted-agreement model; scores are analytical weights, not probability or odds."
      />
      {candidates.length ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <EnsembleStat label="Top weighted score" value={maxScore.toFixed(2)} />
            <EnsembleStat label="Mean weighted score" value={averageScore.toFixed(2)} />
            <EnsembleStat label="Mean strategy agreement" value={averageAgreement.toFixed(1)} />
            <EnsembleStat label="High-signal candidates" value={String(highSignalCount)} />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <ScoringRule
              title="Weighted score"
              detail="The engine adds the configured weight of every active strategy that produced a candidate."
            />
            <ScoringRule
              title="Agreement"
              detail="The count shows how many distinct active strategies produced the same number in the stored run."
            />
            <ScoringRule
              title="Ranking"
              detail="Candidates are ordered by weighted score, then agreement count, then ball number for a stable tie-break."
            />
          </div>
        </>
      ) : (
        <EmptyState label="Analysis scoring will appear once the scheduled ensemble is stored." />
      )}
    </section>
  );
}

function ScoringRule({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/20 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Check className="size-4 text-primary" />
        {title}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function PremiumBenefits() {
  return (
    <section className="mt-6 rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-7">
      <SectionHeading
        icon={Sparkles}
        title="What your Premium membership includes"
        subtitle="One view for the complete stored analysis, without repeating the same information in separate panels."
      />
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Today’s prediction", "The exact scheduled draw window and publication status."],
          [
            "3 highly rated bankers",
            "The strongest stored banker signals with their engine scores.",
          ],
          ["5 ranked balls", "The leading ranked candidates with their scoring detail."],
          [
            "Full wheel and ensemble",
            "Every stored position, agreement value, and analysis score.",
          ],
        ].map(([title, detail]) => (
          <div key={title} className="rounded-xl border border-border/60 bg-background/20 p-4">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PremiumSubscription({ countryCode }: { countryCode: string | undefined }) {
  return (
    <section className="rounded-3xl border border-primary/25 bg-primary/5 p-5 sm:p-7">
      <SectionHeading
        icon={Crown}
        title="Premium subscription"
        subtitle="One clear monthly plan. South African Rand is the source-of-truth billing currency."
      />
      <div className="mt-6 rounded-2xl border border-primary/35 bg-background/30 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {PREMIUM_PLAN.label}
        </p>
        <p className="mt-3 font-display text-4xl font-bold">
          {formatZar(PREMIUM_PLAN.priceZarMinor)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {PREMIUM_PLAN.intervalLabel} · auto-renewing until cancelled
        </p>
        <button
          disabled
          className="mt-5 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-xs font-semibold text-muted-foreground"
        >
          <LockKeyhole className="size-3.5" /> Google Play Billing — coming soon
        </button>
      </div>
      <PremiumBetaInterest />
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Country: <span className="font-semibold text-foreground">{countryCode ?? "…"}</span>. No
        unverified exchange-rate conversion is displayed.
      </p>
    </section>
  );
}

function PremiumBetaInterest() {
  const [registered, setRegistered] = useState(false);
  const interest = useMutation({
    mutationFn: () => registerPremiumBetaInterest(),
    onSuccess: () => {
      setRegistered(true);
      toast.success(
        "You’re on the Premium continuation list. We’ll notify you when the beta window closes.",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
        Premium beta interest
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Interested in Premium fixtures? Join the private notification list. If the beta capacity is
        reached, we will notify registered members about the next availability.
      </p>
      <button
        type="button"
        disabled={registered || interest.isPending}
        onClick={() => interest.mutate()}
        className="mt-3 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {registered
          ? "Interest registered"
          : interest.isPending
            ? "Registering…"
            : "Notify me about Premium availability"}
      </button>
    </div>
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
    <section className="mt-6 rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-7">
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
      <div className="mt-6 rounded-2xl border border-primary/25 bg-background/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {PREMIUM_PLAN.label}
        </p>
        <p className="mt-2 font-display text-3xl font-bold">
          {formatZar(PREMIUM_PLAN.priceZarMinor)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {PREMIUM_PLAN.intervalLabel} · auto-renewing
        </p>
      </div>
      <Link
        to={signedIn ? "/premium" : "/account"}
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
      >
        {signedIn ? "Refresh membership" : "Sign in or create account"}{" "}
        <ArrowRight className="size-4" />
      </Link>
      {signedIn && (
        <>
          <EarlyBirdClaim />
          <PremiumBetaInterest />
        </>
      )}
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
