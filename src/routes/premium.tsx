import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Crown, LockKeyhole, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Entitlement = {
  plan_code: "free" | "premium";
  status: "active" | "trialing" | "past_due" | "canceled" | "expired";
  source: string;
  current_period_end: string | null;
  feature_limits: { saved_strategies?: number; backtest_days?: number; history_depth?: number };
};

type MembershipDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data: Array<Record<string, unknown>> | null; error: Error | null }>;
    };
  };
};

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Lotto IQ AI — Premium Membership" },
      { name: "description", content: "Lotto IQ AI Premium membership and feature access by Lum Tech Solutions." },
    ],
  }),
  component: PremiumPage,
});

const benefits = [
  "Ad-free interface when advertising is activated",
  "More saved strategies than the Free plan",
  "Deeper history and advanced backtesting",
  "Strategy comparison, ensemble views, and performance ledger",
  "Configurable alerts and exportable reports",
];

function PremiumPage() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadMembership = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!auth.user) {
        setLoading(false);
        return;
      }
      setSignedIn(true);
      const db = supabase as unknown as MembershipDb;
      const membership = await db.from("workspace_members").select("workspace_id").eq("user_id", auth.user.id);
      const workspaceId = membership.data?.[0]?.["workspace_id"];
      if (workspaceId) {
        const result = await db.from("workspace_entitlements").select("plan_code,status,source,current_period_end,feature_limits").eq("workspace_id", String(workspaceId));
        const row = result.data?.[0] as Entitlement | undefined;
        if (row && mounted) setEntitlement(row);
      }
      if (mounted) setLoading(false);
    };
    void loadMembership();
    return () => { mounted = false; };
  }, []);

  const isPremium = entitlement?.plan_code === "premium" && ["active", "trialing"].includes(entitlement.status);

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2.5"><span className="grid size-10 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"><Crown className="size-5" /></span><span className="font-display text-lg font-bold">Lotto<span className="gradient-text">IQ</span> AI</span></Link>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Back to dashboard</Link>
      </header>

      <section className="mx-auto max-w-6xl py-12">
        <div className="rounded-3xl border border-primary/20 bg-primary/10 p-7 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Membership dashboard · Lum Tech Solutions</p>
          <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div><h1 className="font-display text-4xl font-bold sm:text-5xl">Choose the analysis depth that fits your workflow.</h1><p className="mt-4 max-w-2xl leading-7 text-muted-foreground">Premium is designed to extend the existing Lotto IQ analysis experience. Billing is not connected yet, so this page reports only verified entitlement state and does not accept payment.</p></div>
            <div className="rounded-2xl border border-border/70 bg-background/35 px-5 py-4 text-sm"><p className="text-muted-foreground">Current membership</p><p className="mt-1 flex items-center gap-2 font-display text-xl font-bold"><span className={`size-2 rounded-full ${isPremium ? "bg-emerald-400" : "bg-muted-foreground"}`} />{loading ? "Checking…" : isPremium ? "Premium" : signedIn ? "Free" : "Not signed in"}</p>{entitlement && <p className="mt-1 text-xs text-muted-foreground">Source: {entitlement.source}</p>}</div>
          </div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="glass rounded-3xl p-6 sm:p-8">
            <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Free</p><p className="mt-2 font-display text-3xl font-bold">R0</p></div><Sparkles className="size-6 text-muted-foreground" /></div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">Keep the core draw history, strategy exploration, and transparent analysis available without payment.</p>
            <div className="mt-6 space-y-3 text-sm"><div className="flex gap-2"><Check className="size-4 text-primary" />Core UK49 analysis</div><div className="flex gap-2"><Check className="size-4 text-primary" />Personal workspace foundation</div><div className="flex gap-2"><Check className="size-4 text-primary" />Current verified data and strategy views</div></div>
          </div>
          <div className="rounded-3xl border border-primary/35 bg-gradient-to-br from-primary/15 via-background to-background p-6 shadow-[0_0_50px_rgba(45,212,191,0.08)] sm:p-8">
            <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-primary">Premium</p><p className="mt-2 font-display text-3xl font-bold">Coming soon</p></div><Crown className="size-7 text-primary" /></div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">These are the planned benefits. They become active only after a real billing provider, webhook verification, entitlement updates, cancellation handling, and refund handling are implemented.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">{benefits.map((benefit) => <div key={benefit} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{benefit}</div>)}</div>
            <button type="button" disabled className="mt-7 inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-border bg-secondary/50 px-5 py-3 text-sm font-semibold text-muted-foreground"><LockKeyhole className="size-4" />Purchases not connected yet</button>
          </div>
        </div>

        <div className="mt-7 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-muted-foreground"><strong className="text-amber-300">Accuracy note:</strong> Premium membership is not being represented as active, and no price is being invented. The current entitlement default is Free until a verified billing integration changes it.</div>
      </section>
    </main>
  );
}
