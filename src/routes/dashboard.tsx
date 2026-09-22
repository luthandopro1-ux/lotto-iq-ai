import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  CirclePlay,
  Flame,
  LockKeyhole,
  Trophy,
  ShieldCheck,
  Snowflake,
  Target,
  WandSparkles,
  Video,
  ArrowRight,
} from "lucide-react";
import { AppShell, Ball, Panel } from "@/components/AppShell";
import {
  getCustomerDashboard,
  type CustomerDashboard,
  type CustomerPrediction,
} from "@/lib/customer.functions";
import { getAccessContext } from "@/lib/customer.functions";
import { supabase } from "@/integrations/supabase/client";
import { memberDisplayName } from "@/lib/member-name";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Lotto IQ — Client Workspace" },
      {
        name: "description",
        content:
          "Private Lotto IQ client workspace with prediction context, draw results and personal formulas.",
      },
    ],
  }),
  component: ClientDashboard,
});

type DashboardData = CustomerDashboard;

type DrawRow = {
  draw_date?: string;
  session?: string;
  n1?: number;
  n2?: number;
  n3?: number;
  n4?: number;
  n5?: number;
  n6?: number;
  booster?: number | null;
};

function numbers(draw: DrawRow) {
  return [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6].filter(
    (value): value is number => typeof value === "number",
  );
}

function ClientDashboard() {
  const liveRefreshMs = 30_000;
  const navigate = useNavigate();
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
  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-dashboard"],
    queryFn: () => getCustomerDashboard(),
    enabled: Boolean(access.data) && access.data?.role !== "administrator",
    refetchInterval: liveRefreshMs,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (access.data?.role === "administrator") void navigate({ to: "/admin", replace: true });
  }, [access.data?.role, navigate]);

  if (session.isLoading || (session.data && access.isLoading) || (access.data && isLoading))
    return (
      <AppShell>
        <div className="space-y-5">
          <div className="h-12 w-72 animate-pulse rounded-xl bg-card" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-36 animate-pulse rounded-2xl bg-card" />
            <div className="h-36 animate-pulse rounded-2xl bg-card" />
            <div className="h-36 animate-pulse rounded-2xl bg-card" />
          </div>
        </div>
      </AppShell>
    );
  if (session.error || access.error)
    return (
      <AppShell>
        <AccessState
          title="We could not verify your session"
          detail="Refresh the page and sign in again to continue."
        />
      </AppShell>
    );
  if (!session.data)
    return (
      <AppShell>
        <AccessState
          title="Sign in to your client workspace"
          detail="Your private dashboard is available after secure account authentication."
        />
      </AppShell>
    );
  if (access.data?.role === "administrator") return null;
  if (error)
    return (
      <AppShell>
        <div className="mx-auto max-w-lg py-20 text-center">
          <LockKeyhole className="mx-auto size-10 text-destructive" />
          <h1 className="mt-5 font-display text-2xl font-bold">Sign in to your workspace</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This dashboard is private. Create or access your account before any client data is
            returned.
          </p>
          <Link
            to="/account"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Open secure account access
          </Link>
        </div>
      </AppShell>
    );
  if (!data)
    return (
      <AppShell>
        <div className="py-20 text-center text-sm text-muted-foreground">
          No client workspace data is available.
        </div>
      </AppShell>
    );
  return <DashboardContent data={data} memberName={memberDisplayName(session.data.user)} />;
}

function AccessState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <LockKeyhole className="mx-auto size-10 text-primary" />
      <h1 className="mt-5 font-display text-2xl font-bold">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
      <Link
        to="/account"
        className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
      >
        Open secure account access
      </Link>
    </div>
  );
}

function DashboardContent({ data, memberName }: { data: DashboardData; memberName: string }) {
  const prediction =
    data.predictions.find((item) => item.targetDate === data.nextReview.date) ?? null;
  return (
    <AppShell>
      <div className="space-y-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              Client workspace <span className="text-muted-foreground">/</span> Overview
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              Welcome, {memberName}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Your Free workspace includes the next scheduled prediction, verified draw results, the
              client-safe number pool, hot and cold signals, and a simple analysis view. Premium
              adds the complete scored ensemble, three highly rated bankers, five ranked balls, full
              wheel structure, and transparent scoring detail.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground">
              {data.planCode === "premium" ? "Premium member" : "Free member"}
            </span>
            <Link
              to="/premium"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary/60"
            >
              {data.planCode === "premium" ? "Open Premium" : "View Premium"}
            </Link>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Stat
            icon={CalendarDays}
            label="Next review"
            value={`${data.nextReview.session} · ${data.nextReview.date}`}
          />
          <Stat
            icon={Target}
            label="Prediction line"
            value={
              prediction?.sevenBallRanking.length
                ? `${prediction.sevenBallRanking.length} ranked balls`
                : "Not published"
            }
          />
          <Stat icon={CheckCircle2} label="Access boundary" value="Workspace isolated" />
        </div>
        <TodayPredictionPanel prediction={prediction} nextReview={data.nextReview} />
        <section className="rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Free plan
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold">
                A useful daily brief, without the noise.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Stay informed with the published prediction line, 14-ball client-safe pool, hot and
                cold signals, recent results, and product education. Upgrade when you want the
                deeper scoring engine and full Premium analysis.
              </p>
            </div>
            <Link
              to="/premium"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Explore Premium <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
        <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <Panel
            title="14-ball pool"
            action={<span className="text-xs text-muted-foreground">Client-safe projection</span>}
          >
            <p className="mb-4 text-sm text-muted-foreground">
              Numbers returned for your current review window.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {prediction?.pool.map((ball) => (
                <Ball
                  key={ball}
                  n={ball}
                  variant={prediction.sevenBallRanking.includes(ball) ? "primary" : "default"}
                />
              )) ?? <p className="text-sm text-muted-foreground">No pool is published yet.</p>}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  <Flame className="size-4" />
                  Hot balls
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {prediction?.hotBalls.map((ball) => (
                    <Ball key={ball} n={ball} variant="primary" />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-indigo-400/20 bg-indigo-400/5 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  <Snowflake className="size-4" />
                  Cold balls
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {prediction?.coldBalls.map((ball) => (
                    <Ball key={ball} n={ball} />
                  ))}
                </div>
              </div>
            </div>
          </Panel>
          <Panel title="Seven-ball ranking">
            <p className="mb-4 text-sm text-muted-foreground">
              Signal order only. Premium rationale is not shown here.
            </p>
            <div className="space-y-2">
              {prediction?.sevenBallRanking.map((ball, index) => (
                <div
                  key={`${ball}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/30 p-2.5"
                >
                  <span className="w-5 text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Ball n={ball} variant={index === 0 ? "primary" : "default"} />
                  <span className="text-sm text-muted-foreground">Ranked ball</span>
                </div>
              )) ?? <p className="text-sm text-muted-foreground">No ranking is published yet.</p>}
            </div>
          </Panel>
        </div>
        <FreeAnalysisPanel
          analysisNumbers={data.analysisNumbers}
          bankers={prediction?.bankers ?? data.prediction?.bankers ?? []}
          wheel={data.wheel}
        />
        <PredictionHistory predictions={data.predictions} />
        <Panel
          title="Latest results by draw"
          action={
            <Link to="/account" className="text-xs text-primary hover:underline">
              Account settings
            </Link>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            {(data.draws as DrawRow[]).map((draw, index) => (
              <div
                key={`${draw.draw_date}-${draw.session}-${index}`}
                className="rounded-xl border border-border/60 p-4"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{draw.draw_date}</span>
                  <span className="text-primary">{draw.session}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {numbers(draw).map((ball) => (
                    <Ball key={ball} n={ball} />
                  ))}
                  {draw.booster != null && <Ball n={draw.booster} variant="accent" />}
                </div>
              </div>
            ))}
            {data.draws.length === 0 && (
              <p className="text-sm text-muted-foreground">No draw results are available yet.</p>
            )}
          </div>
        </Panel>
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Client education
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold">Three short product videos</h2>
            </div>
            <span className="text-xs text-muted-foreground">Included with access</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {data.videos.map((video) => (
              <div key={video.title} className="glass glass-hover rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Video className="size-5" />
                  </span>
                  <span className="text-xs text-muted-foreground">{video.duration}</span>
                </div>
                <p className="mt-6 text-xs uppercase tracking-wider text-muted-foreground">
                  {video.category}
                </p>
                <h3 className="mt-2 font-display font-semibold">{video.title}</h3>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-primary"
                >
                  <CirclePlay className="size-4" />
                  Watch preview
                </button>
              </div>
            ))}
          </div>
        </section>
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/30 p-4 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          Historical signals are review aids, not guarantees. Lottery outcomes remain random.
        </div>
      </div>
    </AppShell>
  );
}

function TodayPredictionPanel({
  prediction,
  nextReview,
}: {
  prediction: CustomerPrediction | null;
  nextReview: { date: string; session: string };
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const pool = prediction?.pool ?? [];
  const toggle = (number: number) =>
    setSelected((current) =>
      current.includes(number)
        ? current.filter((item) => item !== number)
        : current.length < 2
          ? [...current, number]
          : [current[1]!, number],
    );
  return (
    <section className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-5 shadow-sm sm:p-7">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Today’s prediction
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold">
            {nextReview.date} · {nextReview.session}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            One focused brief for the next draw. Graded results stay in history below.
          </p>
        </div>
        <span className="rounded-full border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary">
          {prediction?.status ?? "Not published"}
        </span>
      </div>
      {!prediction ? (
        <p className="mt-6 rounded-2xl border border-border/60 bg-background/30 p-5 text-sm text-muted-foreground">
          The daily prediction has not been published yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                7-number ranking
              </p>
              <span className="text-xs text-muted-foreground">Platform signal order</span>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-2">
              {prediction.sevenBallRanking.map((number, index) => (
                <div key={`${number}-${index}`} className="text-center">
                  <Ball
                    n={number}
                    variant={index === 0 ? "primary" : "default"}
                    className="mx-auto !size-10 !text-xs"
                  />
                  <span className="mt-1 block text-[10px] text-muted-foreground">#{index + 1}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-primary">
              Make your own pair
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Select any two numbers from the 14-ball pool.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {pool.map((number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => toggle(number)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selected.includes(number) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/30 hover:border-primary/60"}`}
                >
                  {String(number).padStart(2, "0")}
                </button>
              ))}
            </div>
            {selected.length === 2 && (
              <p className="mt-3 text-sm font-semibold text-primary">
                Your pair: {selected.map((number) => String(number).padStart(2, "0")).join(" + ")}
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                10 smart pairs + bonus
              </p>
              <WandSparkles className="size-4 text-primary" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Generated from the highest-rated platform ensemble. Strategy definitions remain
              private.
            </p>
            <div className="mt-3 space-y-2">
              {prediction.smartPairs.map((row, index) => (
                <div
                  key={`${row.banker}-${row.bonus}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-background/30 px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-semibold">
                    {row.pair.map((number) => String(number).padStart(2, "0")).join(" + ")}
                  </span>
                  <span className="text-primary">B {String(row.bonus).padStart(2, "0")}</span>
                </div>
              ))}
              {!prediction.smartPairs.length && (
                <p className="text-sm text-muted-foreground">Smart pairs are not published yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function FreeAnalysisPanel({
  analysisNumbers,
  bankers,
  wheel,
}: {
  analysisNumbers: number[];
  bankers: number[];
  wheel: CustomerDashboard["wheel"];
}) {
  return (
    <Panel title="24-number analysis and wheel">
      <p className="mb-4 text-sm text-muted-foreground">
        A clean view of the platform signal structure. Use the 14-ball pool above to build your own
        pair.
      </p>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Total 24 numbers
          </p>
          <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-8">
            {analysisNumbers.map((number, index) => (
              <div key={number} className="flex flex-col items-center gap-1">
                <Ball n={number} className="!size-10 !text-xs" />
                <span className="text-[10px] text-muted-foreground">#{index + 1}</span>
              </div>
            ))}
          </div>
          {!analysisNumbers.length && (
            <p className="mt-3 text-sm text-muted-foreground">Analysis is not published yet.</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Wheel structure
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Top wheel positions available in your plan.
          </p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {wheel.slice(0, 10).map((item, index) => (
              <div key={item.number} className="text-center">
                <Ball
                  n={item.number}
                  variant={index < 3 ? "primary" : "default"}
                  className="mx-auto !size-9 !text-xs"
                />
                <span className="mt-1 block text-[10px] text-muted-foreground">W{index + 1}</span>
              </div>
            ))}
          </div>
          {!wheel.length && (
            <p className="mt-3 text-sm text-muted-foreground">
              The wheel is not published for this workspace yet.
            </p>
          )}
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-primary">
            7 platform bankers
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {bankers.map((number) => (
              <Ball key={number} n={number} variant="primary" />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function PredictionHistory({ predictions }: { predictions: CustomerPrediction[] }) {
  return (
    <Panel title="Graded history by draw">
      <p className="mb-4 text-sm text-muted-foreground">
        History is kept below today’s brief. Each draw shows the prediction, winning numbers, and
        exactly which numbers matched.
      </p>
      <div className="space-y-3">
        {predictions.map((prediction) => {
          const matchedNumbers = new Set(prediction.actualNumbers);
          return (
            <div
              key={`${prediction.targetDate}-${prediction.targetSession}`}
              className="rounded-xl border border-border/60 bg-background/20 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-foreground">
                  {prediction.targetDate} · {prediction.targetSession}
                </span>
                <span className="uppercase tracking-wider text-muted-foreground">
                  {prediction.outcome ?? prediction.status}
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Predicted
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {prediction.pool.map((number) => (
                      <Ball
                        key={number}
                        n={number}
                        variant={matchedNumbers.has(number) ? "matched" : "default"}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    Winning numbers
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {prediction.actualNumbers.length ? (
                      prediction.actualNumbers.map((number) => (
                        <Ball
                          key={number}
                          n={number}
                          variant={prediction.pool.includes(number) ? "matched" : "accent"}
                        />
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Awaiting verified result.
                      </span>
                    )}
                  </div>
                  {prediction.actualNumbers.length ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {prediction.matchedCount} match{prediction.matchedCount === 1 ? "" : "es"}
                    </p>
                  ) : null}
                  {prediction.actualNumbers.length ? (
                    <p className="mt-1 text-xs text-emerald-300">
                      Matched:{" "}
                      {prediction.actualNumbers
                        .filter((number) => prediction.pool.includes(number))
                        .join(", ") || "none"}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        {!predictions.length && (
          <p className="text-sm text-muted-foreground">No prediction records are available yet.</p>
        )}
      </div>
    </Panel>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="glass glass-hover rounded-2xl p-5">
      <Icon className="size-4 text-primary" />
      <p className="mt-3 font-display text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
