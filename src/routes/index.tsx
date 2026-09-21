import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  FlaskConical,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Ball } from "@/components/AppShell";
import { BrandMark } from "@/components/BrandMark";
import { BrandCopyright } from "@/components/BrandCopyright";
import { useQuery } from "@tanstack/react-query";
import { getEarlyBirdStatus } from "@/lib/pricing.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lotto IQ — UK49 Strategy Analysis by Lum Tech Solutions" },
      {
        name: "description",
        content:
          "Explore UK49 draw history, compare strategy signals, and stress-test your own analysis workflow with Lotto IQ by Lum Tech Solutions.",
      },
      { name: "author", content: "Lum Tech Solutions" },
      { property: "og:title", content: "Lotto IQ — UK49 Strategy Analysis" },
      {
        property: "og:description",
        content:
          "A transparent UK49 strategy-analysis workspace from Lum Tech Solutions. No guarantees, no claims of changing random odds.",
      },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: Database,
    title: "Work from draw history",
    description:
      "Bring historical UK49 results into the analysis workflow through the existing sync, import, or manual-entry tools.",
  },
  {
    icon: FlaskConical,
    title: "Test strategy ideas",
    description:
      "Use the existing strategy library to compare rule-based signals, weights, and historical overlap.",
  },
  {
    icon: BarChart3,
    title: "See ranked candidates",
    description:
      "The dashboard presents a ranked number output when usable draw history is available for the engine.",
  },
];

const principles = [
  "Historical analysis, not a promise of future outcomes",
  "Transparent strategy inputs and repeatable workflows",
  "Developed by Lum Tech Solutions",
];

function LandingPage() {
  const earlyBird = useQuery({
    queryKey: ["early-bird-availability"],
    queryFn: () => getEarlyBirdStatus(),
    refetchInterval: 30_000,
  });

  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark className="size-10 rounded-2xl" />
          <span className="font-display text-lg font-bold tracking-tight">
            Lotto<span className="gradient-text">IQ</span> AI
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/dashboard"
            className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 sm:inline-flex"
          >
            Dashboard
          </Link>
          <Link
            to="/account"
            className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 sm:inline-flex"
          >
            Create account
          </Link>
          <Link
            to="/strategies"
            className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground md:inline-flex"
          >
            Strategies
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Explore Lotto IQ <ArrowRight className="size-4" />
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-28 lg:pt-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="size-3.5" /> Early Bird · first 1,000 testers
          </div>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Make your lottery analysis <span className="gradient-text">repeatable.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            Lotto IQ helps you organize UK49 draw history, run defined strategies, and inspect
            ranked candidate numbers in one focused workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_-10px_var(--color-primary)] transition-transform hover:-translate-y-0.5"
            >
              Open the dashboard <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/draws"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/30 px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary/60"
            >
              View draw workflow
            </Link>
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Create your workspace
            </Link>
          </div>
          <p className="mt-5 max-w-xl text-xs leading-6 text-muted-foreground">
            Lotto IQ analyses historical results and user-defined strategies. Lottery draws are
            random; this product does not guarantee outcomes or claim to change the odds.
          </p>
          <div className="mt-7 rounded-2xl border border-primary/25 bg-primary/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Early Bird Special
                </p>
                <p className="mt-1 text-sm font-semibold">
                  Live system access with no payment required
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  The first 1,000 authenticated testers receive the current Premium workspace while
                  we validate the live product. No adverts are shown in this test programme.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-2xl font-bold text-primary">
                  {earlyBird.data?.remaining.toLocaleString("en-GB") ?? "—"}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  places remaining
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-3xl" />
          <div className="glass relative rounded-[2rem] p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between border-b border-border/70 pb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Lotto IQ dashboard
                </p>
                <p className="mt-1 font-display text-lg font-semibold">Ranked candidate view</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                Engine ready
              </span>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Top ranked candidates</span>
                <span>Strategy overlap</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {[7, 14, 23, 31, 44].map((number, index) => (
                  <div key={number} className="text-center">
                    <Ball
                      n={number}
                      variant={index === 0 ? "primary" : index < 3 ? "accent" : "default"}
                    />
                    <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                      {(9.4 - index * 0.8).toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">
                Demonstration layout only. Live values depend on available draw history and the
                active strategy set.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {["11 strategies", "4 draw sessions", "1 analysis loop"].map((label) => (
                <div
                  key={label}
                  className="rounded-xl border border-border/60 bg-card/40 px-2 py-3 text-[10px] font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Built around the current product
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
            A clearer way to work with your strategies.
          </h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            The public experience introduces the same analysis foundation already available in Lotto
            IQ, without inventing capabilities that are not yet live.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article key={title} className="glass glass-hover rounded-2xl p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 pb-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Product principles
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold">Useful, inspectable, and honest.</h2>
        </div>
        <div className="space-y-3">
          {principles.map((principle) => (
            <div
              key={principle}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/20 p-4 text-sm text-muted-foreground"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{principle}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-5 mb-12 rounded-3xl border border-primary/20 bg-primary/10 px-6 py-10 text-center sm:mx-8 sm:px-10">
        <Target className="mx-auto size-7 text-primary" />
        <h2 className="mt-4 font-display text-3xl font-bold">
          Start with the analysis that exists today.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Explore the current dashboard, import draw history, and see how the existing strategy
          engine works. Accounts and Premium features will be introduced only when they are ready.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Open Lotto IQ <ArrowRight className="size-4" />
        </Link>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-border/60 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>
          <BrandCopyright />
        </span>
        <span className="inline-flex flex-wrap items-center gap-3">
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/support" className="hover:text-foreground">
            Support
          </Link>
          <Link to="/faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link to="/notifications" className="hover:text-foreground">
            Notifications
          </Link>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-primary" /> Historical analysis only. No
            guaranteed outcomes.
          </span>
        </span>
      </footer>
    </main>
  );
}
