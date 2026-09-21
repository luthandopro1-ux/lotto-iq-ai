import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  CirclePlay,
  Flame,
  LockKeyhole,
  ShieldCheck,
  Snowflake,
  Target,
  Video,
} from "lucide-react";
import { AppShell, Ball, Panel } from "@/components/AppShell";
import { getCustomerDashboard, type CustomerDashboard } from "@/lib/customer.functions";
import { getAccessContext } from "@/lib/customer.functions";
import { supabase } from "@/integrations/supabase/client";

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
  return <DashboardContent data={data} />;
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

function DashboardContent({ data }: { data: DashboardData }) {
  const prediction = data.prediction;
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
              Your current draw brief.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              This client view intentionally excludes the ledger, strategy uploads, ensemble
              statistics, wheel, and candidate descriptions. Your formulas remain private to your
              workspace.
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
            value={
              prediction
                ? `${prediction.targetSession} · ${prediction.targetDate}`
                : "Awaiting prediction"
            }
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
        <Panel
          title="Past draw results"
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
