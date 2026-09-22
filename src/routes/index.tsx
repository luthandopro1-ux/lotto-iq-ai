import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  FlaskConical,
  Gauge,
  Layers3,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Ball } from "@/components/AppShell";
import { BrandMark } from "@/components/BrandMark";
import { BrandCopyright } from "@/components/BrandCopyright";
import { getEarlyBirdStatus } from "@/lib/pricing.functions";
import { formatZar, PREMIUM_PLAN } from "@/lib/pricing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lotto IQ — Intelligent Lottery Data Analysis" },
      {
        name: "description",
        content:
          "Explore lottery draw history, statistical analysis, multiple strategy signals, rankings, and explainable insights in one Lotto IQ workspace.",
      },
      { name: "author", content: "Lum Tech Solutions" },
      { property: "og:title", content: "Lotto IQ — Intelligent Lottery Data Analysis" },
      {
        property: "og:description",
        content:
          "A transparent lottery-data analysis workspace for exploring draw history, strategies, rankings, and historical signals.",
      },
    ],
  }),
  component: LandingPage,
});

const valueCards = [
  {
    icon: Database,
    title: "Structured data",
    description: "Review available draw history in an organized, session-aware workspace.",
  },
  {
    icon: FlaskConical,
    title: "Multiple methods",
    description:
      "Compare statistical, mathematical, and strategy-based signals instead of relying on one view.",
  },
  {
    icon: BarChart3,
    title: "Explainable outputs",
    description:
      "See rankings, agreement, scores, and historical context presented in a readable interface.",
  },
  {
    icon: Layers3,
    title: "One workspace",
    description: "Move from draw history to analysis and review without disconnected tools.",
  },
];

const capabilityGroups = [
  [
    "Statistical analysis",
    "Frequency, gaps, distributions, recency, and related historical measures.",
  ],
  [
    "Pattern and relationships",
    "Pairs, combinations, recurrence, and relationships within available data.",
  ],
  [
    "Strategy analysis",
    "Multiple configured strategies can contribute signals to a ranked output.",
  ],
  [
    "Evaluation tools",
    "Historical review and backtesting help you inspect how an approach behaved before.",
  ],
];

const steps = [
  ["01", "Data", "Available draw information is collected and structured."],
  ["02", "Analyse", "The platform processes the available information through analytical methods."],
  ["03", "Evaluate", "Multiple strategies and signals are compared in the same workflow."],
  ["04", "Explore", "You review rankings, ensembles, wheel structure, and historical context."],
];

const faqs = [
  [
    "What is Lotto IQ?",
    "Lotto IQ is a lottery-data analysis platform combining draw history, statistical analysis, mathematical strategies, rankings, and explainable insights.",
  ],
  [
    "Is Lotto IQ free?",
    "Yes. The Free workspace provides selected draw information, client-safe signals, recent results, and basic analysis. Premium adds the complete stored analytical view.",
  ],
  [
    "Does Lotto IQ guarantee winning numbers?",
    "No. Lottery outcomes are random. Lotto IQ provides analytical tools and historical signals, not guaranteed outcomes or changed odds.",
  ],
  [
    "What does Lotto IQ analyse?",
    "The production workflow currently focuses on supported UK49s draw sessions and the analytical data available to the platform.",
  ],
  [
    "Can I use Lotto IQ on mobile?",
    "The public website and application are responsive and designed to work across modern desktop and mobile browsers.",
  ],
];

function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const earlyBird = useQuery({
    queryKey: ["early-bird-availability"],
    queryFn: () => getEarlyBirdStatus(),
    refetchInterval: 30_000,
  });
  const remaining = earlyBird.data?.remaining;
  const betaOpen = earlyBird.data?.enabled === true && (remaining ?? 0) > 0;

  return (
    <main className="min-h-screen overflow-hidden">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Lotto IQ home">
            <BrandMark className="size-10 rounded-2xl" />
            <span className="font-display text-lg font-bold tracking-tight">
              Lotto<span className="gradient-text">IQ</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            <AnchorLink href="#product">Product</AnchorLink>
            <AnchorLink href="#how-it-works">How It Works</AnchorLink>
            <AnchorLink href="#features">Features</AnchorLink>
            <AnchorLink href="#pricing">Pricing</AnchorLink>
            <AnchorLink href="#faq">FAQ</AnchorLink>
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            <Link
              to="/account"
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Get started <ArrowRight className="size-4" />
            </Link>
          </div>
          <button
            type="button"
            className="rounded-lg border border-border p-2 sm:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-border/50 px-5 py-4 sm:hidden">
            <nav className="grid gap-1">
              {["product", "how-it-works", "features", "pricing", "faq"].map((id) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                >
                  {id === "how-it-works" ? "How It Works" : id[0]!.toUpperCase() + id.slice(1)}
                </a>
              ))}
              <Link
                to="/account"
                className="mt-2 rounded-xl bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground"
              >
                Get started free
              </Link>
            </nav>
          </div>
        )}
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pb-28 lg:pt-24">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="size-3.5" /> Intelligent lottery data analysis
          </div>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.04] tracking-tight sm:text-6xl">
            Explore lottery data with a <span className="gradient-text">clearer workflow.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            Lotto IQ brings draw history, statistical analysis, multiple strategy signals, rankings,
            and explainable insights together in one focused workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_-10px_var(--color-primary)] hover:-translate-y-0.5"
            >
              Start free <ArrowRight className="size-4" />
            </Link>
            <a
              href="#product"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/30 px-5 py-3 text-sm font-semibold hover:bg-secondary/60"
            >
              See the product
            </a>
          </div>
          <p className="mt-5 max-w-xl text-xs leading-6 text-muted-foreground">
            Lottery outcomes are random. Lotto IQ provides analytical tools and insights for
            informational and entertainment purposes; it does not guarantee outcomes or change the
            odds.
          </p>
          <div className="mt-7 rounded-2xl border border-primary/25 bg-primary/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Early Bird beta
                </p>
                <p className="mt-1 text-sm font-semibold">
                  Explore the live Premium workspace while testing is open.
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  No payment is required for the current beta entitlement. Capacity and availability
                  are shown from the live system.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-2xl font-bold text-primary">
                  {remaining?.toLocaleString("en-GB") ?? "—"}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  places remaining
                </p>
              </div>
            </div>
            {betaOpen && (
              <Link
                to="/account"
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
              >
                Join the beta <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
        <ProductPreview />
      </section>

      <section id="product" className="scroll-mt-24 border-y border-border/50 bg-card/20">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <SectionIntro
            eyebrow="Product value"
            title="A smarter way to explore lottery data"
            detail="Lotto IQ is built around repeatable analysis and readable outputs, not exaggerated promises."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {valueCards.map(({ icon: Icon, title, description }) => (
              <article key={title} className="glass glass-hover rounded-2xl p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:items-start">
          <SectionIntro
            eyebrow="Core capabilities"
            title="The tools that make the workflow useful"
            detail="The public page describes the product without exposing proprietary formulas, internal strategy definitions, or implementation details."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {capabilityGroups.map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-border/70 bg-card/30 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="size-4 text-primary" /> {title}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border/50 bg-primary/[0.035]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <SectionIntro
            eyebrow="Product experience"
            title="See the product before you create an account"
            detail="One platform, from available draw information to an organized analytical view."
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <ShowcaseCard
              icon={Gauge}
              title="Free dashboard"
              detail="A client-safe daily brief with the published pool, hot and cold signals, recent results, and a clear next review."
            />
            <ShowcaseCard
              icon={BarChart3}
              title="Premium ensemble"
              detail="Three highly rated bankers, five ranked balls, full candidate scoring, agreement, and the original stored ensemble."
            />
            <ShowcaseCard
              icon={Zap}
              title="Dream Wheel"
              detail="Explore the full wheel sequence with each position, score, and agreement detail in one visual structure."
            />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <SectionIntro
          eyebrow="How Lotto IQ works"
          title="Four stages. One focused analytical workflow."
          detail="The public explanation stays simple. The application contains the full workspace and data boundaries."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {steps.map(([number, title, detail]) => (
            <div
              key={number}
              className="relative rounded-2xl border border-border/70 bg-card/30 p-5"
            >
              <span className="font-mono text-xs font-semibold text-primary">{number}</span>
              <h3 className="mt-8 font-display text-xl font-bold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/50 bg-card/20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">
          <SectionIntro
            eyebrow="Analytical engine"
            title="Multiple analytical methods. One platform."
            detail="Lotto IQ organizes the methods already supported by the application into a workflow that is easier to inspect and understand."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {capabilityGroups.map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-border/70 bg-background/30 p-5">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <SectionIntro
          eyebrow="Free versus Premium"
          title="Start free. Go further with Premium."
          detail="The Free workspace is useful on its own. Premium brings the complete stored analytical picture into one view."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <PlanCard
            title="Free"
            subtitle="A clear starting point"
            items={[
              "Selected draw results",
              "Client-safe prediction pool",
              "Hot and cold signals",
              "Basic analysis and recent results",
              "Responsive workspace access",
            ]}
            cta="Start free"
            to="/account"
          />
          <PlanCard
            title="Premium"
            subtitle="The complete analytical view"
            items={[
              "Today’s prediction first",
              "3 highly rated bankers with scores",
              "5 ranked balls with scoring detail",
              "Full ensemble and wheel structure",
              "Analysis scoring and expanded session view",
            ]}
            cta="Explore Premium"
            to="/premium"
            highlighted
            price={formatZar(PREMIUM_PLAN.priceZarMinor)}
          />
        </div>
        <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
          Premium recurring billing is being prepared for Google Play. The current beta entitlement
          does not represent a completed paid transaction.
        </p>
      </section>

      <section className="border-y border-border/50 bg-card/20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">
          <SectionIntro
            eyebrow="Supported games"
            title="Start with the production-supported UK49s workflow"
            detail="Lotto IQ currently presents the draw sessions supported by the live application. More games should only be promoted after their implementation is production-ready."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Supported game
              </p>
              <h3 className="mt-2 font-display text-2xl font-bold">UK49s</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                A session-aware workflow across the live UK49s draw schedule.
              </p>
            </div>
            {["Brunch", "Lunch", "Drive Time", "Tea Time"].map((session) => (
              <div
                key={session}
                className="rounded-xl border border-border/70 bg-background/30 p-4"
              >
                <p className="text-sm font-semibold">{session}</p>
                <p className="mt-1 text-xs text-muted-foreground">Scheduled draw session</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
        <div>
          <SectionIntro
            eyebrow="Dream Wheel"
            title="Explore the Lotto IQ wheel experience"
            detail="The Dream Wheel presents the current sequence as a visual product experience. Open the application for the full interactive detail."
          />
          <Link
            to="/dashboard"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            Explore the workspace <ArrowRight className="size-4" />
          </Link>
        </div>
        <img
          src="/lotto-iq-dream-wheel.jpg"
          alt="Lotto IQ Dream Wheel"
          className="mx-auto aspect-square w-full max-w-md rounded-3xl border border-border/70 object-cover shadow-2xl shadow-primary/10"
        />
      </section>

      <section className="border-y border-border/50 bg-primary/[0.035]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <ShieldCheck className="mx-auto size-8 text-primary" />
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Trust and transparency
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              Analysis, not guarantees.
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Lotto IQ helps users explore historical lottery data through structured analytical
              methods. Lottery outcomes remain random, and no strategy, model, banker, or ranking
              can guarantee a result.
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            {[
              ["Data", "Work from structured lottery information."],
              ["Methods", "Use multiple analytical approaches."],
              ["Decisions", "Interpret information and make your own decisions."],
            ].map(([title, detail]) => (
              <div
                key={title}
                className="rounded-2xl border border-border/70 bg-card/40 p-5 text-center"
              >
                <p className="font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="rounded-3xl border border-primary/25 bg-primary/10 p-6 sm:p-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Beta and app launch
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold">Lotto IQ is growing.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                Join the beta to help test performance, evaluate features, and provide feedback
                before wider release. Store availability will be announced only when the app is
                approved and live.
              </p>
            </div>
            <Link
              to="/account"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Join the beta <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 mx-auto max-w-4xl px-5 pb-20 sm:px-8">
        <SectionIntro
          eyebrow="FAQ"
          title="Clear answers before you start"
          detail="If you need more context, visit the full FAQ and support pages."
        />
        <div className="mt-8 divide-y divide-border/70 rounded-2xl border border-border/70 bg-card/30 px-5">
          {faqs.map(([question, answer]) => (
            <details key={question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">
                <span>{question}</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-5 mb-12 rounded-3xl border border-primary/20 bg-primary/10 px-6 py-12 text-center sm:mx-8 sm:px-10">
        <Target className="mx-auto size-8 text-primary" />
        <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
          Explore lottery data differently.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
          Start with the Free workspace and move into deeper analysis when you are ready.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/account"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Get started free <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/account"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/30 px-5 py-3 text-sm font-semibold"
          >
            Log in
          </Link>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          Historical analysis only. No guaranteed outcomes.
        </p>
      </section>

      <footer className="mx-auto max-w-7xl border-t border-border/60 px-5 py-10 sm:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <BrandMark className="size-9 rounded-xl" />
              <span className="font-display font-bold">
                Lotto<span className="gradient-text">IQ</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-xs leading-5 text-muted-foreground">
              Intelligent lottery data analysis by Lum Tech Solutions.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm text-muted-foreground sm:grid-cols-3">
            <a href="#product" className="hover:text-foreground">
              Product
            </a>
            <a href="#how-it-works" className="hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
            <Link to="/faq" className="hover:text-foreground">
              FAQ
            </Link>
            <Link to="/support" className="hover:text-foreground">
              Support
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/account" className="hover:text-foreground">
              Account
            </Link>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <BrandCopyright />
          <span className="inline-flex items-center gap-2">
            <LockKeyhole className="size-3.5 text-primary" /> Secure account access
          </span>
        </div>
      </footer>
    </main>
  );
}

function AnchorLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
    >
      {children}
    </a>
  );
}

function SectionIntro({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">{detail}</p>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-3xl" />
      <div className="glass relative rounded-[2rem] p-5 shadow-2xl shadow-primary/10 sm:p-7">
        <div className="mb-5 flex items-center justify-between border-b border-border/70 pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              Lotto IQ workspace
            </p>
            <p className="mt-1 font-display text-lg font-semibold">Today’s analytical view</p>
          </div>
          <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
            Stored analysis
          </span>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Ranked candidates</span>
            <span>Score and agreement</span>
          </div>
          <div className="mt-5 grid grid-cols-5 gap-2 sm:gap-3">
            {[7, 14, 23, 31, 44].map((number, index) => (
              <div key={number} className="text-center">
                <Ball
                  n={number}
                  variant={index === 0 ? "primary" : index < 3 ? "accent" : "default"}
                  className="mx-auto !size-11 !text-sm"
                />
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  {(9.4 - index * 0.8).toFixed(1)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-2 border-t border-border/60 pt-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ensemble</span>
              <span className="font-semibold text-primary">Full stored view</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Wheel</span>
              <span className="font-semibold">Sequence ready</span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            ["Free", "daily brief"],
            ["Premium", "full ensemble"],
            ["UK49s", "4 sessions"],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-xl border border-border/60 bg-card/40 px-2 py-3">
              <p className="text-xs font-semibold">{title}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[10px] leading-5 text-muted-foreground">
          Illustrative product preview. Live values are generated from available draw data.
        </p>
      </div>
    </div>
  );
}

function ShowcaseCard({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Gauge;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/30 p-5">
      <div className="flex items-center justify-between">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Lotto IQ
        </span>
      </div>
      <div className="mt-6 rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="flex gap-1.5">
          <span className="size-2 rounded-full bg-primary" />
          <span className="size-2 rounded-full bg-border" />
          <span className="size-2 rounded-full bg-border" />
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {[7, 14, 23, 31].map((number, index) => (
            <span
              key={number}
              className={`grid aspect-square place-items-center rounded-full text-xs font-bold ${index === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              {number}
            </span>
          ))}
        </div>
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

function PlanCard({
  title,
  subtitle,
  items,
  cta,
  to,
  highlighted,
  price,
}: {
  title: string;
  subtitle: string;
  items: string[];
  cta: string;
  to: "/account" | "/premium";
  highlighted?: boolean;
  price?: string;
}) {
  return (
    <div
      className={`rounded-3xl border p-6 sm:p-7 ${highlighted ? "border-primary/35 bg-primary/5 shadow-xl shadow-primary/5" : "border-border/70 bg-card/30"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">{title}</p>
          <h3 className="mt-2 font-display text-2xl font-bold">{subtitle}</h3>
        </div>
        {highlighted && <Sparkles className="size-5 text-primary" />}
      </div>
      {price && (
        <p className="mt-6 font-display text-4xl font-bold">
          {price}
          <span className="ml-2 text-xs font-normal text-muted-foreground">per month</span>
        </p>
      )}
      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            {item}
          </li>
        ))}
      </ul>
      <Link
        to={to}
        className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${highlighted ? "bg-primary text-primary-foreground" : "border border-border bg-background/30"}`}
      >
        {cta}
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
