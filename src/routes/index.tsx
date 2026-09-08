import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Panel, Ball } from "@/components/AppShell";
import {
  SESSION_LABELS,
  currentSession,
  drawNumbers,
  type Draw,
  type Strategy,
} from "@/lib/uk49";
import { runAnalysis } from "@/lib/engine";
import { Link } from "@tanstack/react-router";
import { Activity, CalendarDays, Database, Library } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lotto IQ AI — UK49 Strategy Analysis Dashboard" },
      {
        name: "description",
        content:
          "Build, run and backtest custom UK49 strategies against historical draw data with AI-assisted analysis.",
      },
      { property: "og:title", content: "Lotto IQ AI — UK49 Strategy Analysis Dashboard" },
      {
        property: "og:description",
        content:
          "Build, run and backtest custom UK49 strategies against historical draw data with AI-assisted analysis.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: draws = [], isLoading } = useQuery({
    queryKey: ["draws", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("draws")
        .select("*")
        .order("draw_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Draw[];
    },
  });

  const { data: strategies = [] } = useQuery({
    queryKey: ["strategies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("strategies").select("*");
      if (error) throw error;
      return data as Strategy[];
    },
  });

  const active = strategies.filter((s) => s.enabled);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const session = currentSession(now ?? undefined);

  const freq = new Map<number, number>();
  draws.forEach((d) => drawNumbers(d).forEach((n) => freq.set(n, (freq.get(n) ?? 0) + 1)));
  const hot = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([number, count]) => ({ number: String(number), count }));

  const ranked =
    draws.length > 0
      ? runAnalysis(active, {
          date: now ?? new Date(),
          session,
          history: draws,
          previousThree: draws.slice(0, 3),
        }).ranked.slice(0, 6)
      : [];

  const stats = [
    { label: "Draws stored", value: draws.length >= 200 ? "200+" : draws.length, icon: Database },
    { label: "Active strategies", value: active.length, icon: Library },
    { label: "Current session", value: now ? SESSION_LABELS[session] : "—", icon: Activity },
    {
      label: "Today",
      value: now ? now.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—",
      icon: CalendarDays,
    },
  ];


  return (
    <AppShell>
      <div className="glass mb-6 overflow-hidden rounded-3xl p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          UK49 Strategy Intelligence
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold sm:text-4xl">
          Build, run and <span className="gradient-text">stress-test</span> your own
          UK49 strategies.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Paste results in any format and the AI importer files them for you. Every
          active strategy then runs against your history and the outputs are ranked by
          overlap and weight.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/draws"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            AI import draws
          </Link>
          <Link
            to="/analysis"
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary/60"
          >
            Run analysis
          </Link>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Top ranked candidates" className="lg:col-span-2">
          {ranked.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading…" : "Import some draws to generate candidates."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {ranked.map((r, i) => (
                <div key={r.number} className="text-center">
                  <Ball n={r.number} variant={i === 0 ? "primary" : i < 3 ? "accent" : "default"} />
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {r.score.toFixed(1)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Analysis status">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted-foreground">Engine</span>
              <span className="text-primary">Ready</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Strategies loaded</span>
              <span>{strategies.length}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">History depth</span>
              <span>{draws.length} draws</span>
            </li>
          </ul>
        </Panel>

        <Panel title="Most frequent numbers" className="lg:col-span-2">
          {hot.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hot}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Recent draws">
          <div className="space-y-3">
            {draws.slice(0, 5).map((d) => (
              <div key={d.id} className="rounded-xl border border-border/70 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{d.draw_date}</span>
                  <span className="text-primary">{SESSION_LABELS[d.session]}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {drawNumbers(d).map((n, i) => (
                    <span key={i} className="ball size-8 text-xs">
                      {n}
                    </span>
                  ))}
                  {d.booster != null && (
                    <span className="ball ball-accent size-8 text-xs">{d.booster}</span>
                  )}
                </div>
              </div>
            ))}
            {draws.length === 0 && (
              <p className="text-sm text-muted-foreground">No draws imported yet.</p>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
