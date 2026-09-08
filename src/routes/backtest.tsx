import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Panel } from "@/components/AppShell";
import { runBacktest, listBacktests, getBacktest } from "@/lib/backtest.functions";
import type { BacktestRow } from "@/lib/backtest.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, History, Play } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/backtest")({
  head: () => ({
    meta: [
      { title: "Backtesting — Lotto IQ AI" },
      {
        name: "description",
        content:
          "Backtest UK49 strategies over any date range: compare five model variants — formula, statistical, blended and learning-adjusted — with results saved for later.",
      },
      { property: "og:title", content: "UK49 Model A–E Backtesting" },
      {
        property: "og:description",
        content: "Walk-forward comparison of five prediction model variants, saved and browsable.",
      },
    ],
  }),
  component: BacktestPage,
});

interface StrategyOption {
  id: string;
  name: string;
  enabled: boolean;
}

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const MODEL_KEYS = ["A", "B", "C", "D", "E"] as const;

function BacktestPage() {
  const runFn = useServerFn(runBacktest);
  const listFn = useServerFn(listBacktests);
  const getFn = useServerFn(getBacktest);
  const queryClient = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const [selected, setSelected] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: strategies = [] } = useQuery({
    queryKey: ["strategies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("strategies").select("id,name,enabled");
      if (error) throw error;
      return data as StrategyOption[];
    },
  });

  const { data: saved = [] } = useQuery({
    queryKey: ["backtests", "saved"],
    queryFn: () => listFn(),
  });

  const { data: active } = useQuery({
    queryKey: ["backtests", "active", activeId],
    queryFn: () => (activeId ? getFn({ data: { id: activeId } }) : Promise.resolve(null)),
    enabled: Boolean(activeId),
  });

  const run = useMutation({
    mutationFn: () =>
      runFn({
        data: {
          dateFrom: from,
          dateTo: to,
          ...(selected.length ? { strategyIds: selected } : {}),
          ...(label.trim() ? { label: label.trim() } : {}),
        },
      }),
    onSuccess: (row: BacktestRow) => {
      queryClient.invalidateQueries({ queryKey: ["backtests", "saved"] });
      queryClient.setQueryData(["backtests", "active", row.id], row);
      setActiveId(row.id);
      toast.success(`Backtest saved — ${row.results.drawsTested} draws tested.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = (row: BacktestRow) => {
    const csv = [
      ["model", "label", "tests", "total_matches", "avg_matches", "best_matches", "hit_rate_%", "avg_pair_matches"],
      ...row.results.models.map((m) => [
        m.key,
        `"${m.label}"`,
        m.tests,
        m.totalMatches,
        m.avgMatches.toFixed(3),
        m.bestMatches,
        m.hitRate.toFixed(1),
        m.avgPairMatches.toFixed(2),
      ]),
    ]
      .map((r) => r.join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lottoiq-backtest-${row.date_from}_${row.date_to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">Backtesting engine</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Walk every historical draw in the range strictly forward — no lookahead — and compare
        five model variants: pure formula, pure statistics, two blends, and a learning-adjusted
        formula. Every run is saved so it never has to be recomputed to view again.
      </p>

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Label (optional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Q3 review"
              className="w-48"
            />
          </div>
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            <Play className="mr-2 size-4" />
            {run.isPending ? "Running…" : "Run & save backtest"}
          </Button>
        </div>

        <div className="mt-4">
          <Label className="text-xs">Strategies (none selected = all enabled)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {strategies.map((s) => {
              const on = selected.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() =>
                    setSelected(on ? selected.filter((x) => x !== s.id) : [...selected, s.id])
                  }
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    on
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary/60"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Saved runs" className="lg:col-span-1">
          {saved.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved backtests yet — run one to populate this list.
            </p>
          ) : (
            <div className="space-y-2">
              {saved.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setActiveId(row.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    activeId === row.id
                      ? "border-primary/60 bg-primary/15"
                      : "border-border/70 hover:bg-secondary/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{row.label || `${row.date_from} → ${row.date_to}`}</span>
                    <History className="size-3.5 text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {row.results?.drawsTested ?? 0} draws · best {row.results?.best ?? "—"} ·{" "}
                    {new Date(row.created_at).toLocaleDateString("en-GB")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <div className="lg:col-span-2 space-y-6">
          {!active ? (
            <Panel>
              <p className="text-sm text-muted-foreground">
                Run a backtest or pick a saved run from the list to see the Model A–E comparison.
              </p>
            </Panel>
          ) : (
            <>
              <Panel title="Model A–E comparison">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {active.date_from} → {active.date_to} · {active.results.drawsTested} draws
                    tested · {active.strategy_ids.length || "all enabled"} strategies
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => exportCsv(active)}>
                    <Download className="mr-2 size-3.5" />
                    Export CSV
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 pr-4">Model</th>
                        <th className="py-2 pr-4">Tests</th>
                        <th className="py-2 pr-4">Avg / draw</th>
                        <th className="py-2 pr-4">Best</th>
                        <th className="py-2 pr-4">Hit rate</th>
                        <th className="py-2">Avg pair matches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.results.models.map((m) => (
                        <tr
                          key={m.key}
                          className={`border-b border-border/50 ${
                            active.results.best === m.key ? "bg-primary/10" : ""
                          }`}
                        >
                          <td className="py-2 pr-4">
                            <span className="font-mono font-semibold text-primary">{m.key}</span>{" "}
                            <span className="font-medium">{m.label}</span>
                            <p className="text-[10px] text-muted-foreground">{m.description}</p>
                          </td>
                          <td className="py-2 pr-4 font-mono text-muted-foreground">{m.tests}</td>
                          <td className="py-2 pr-4 font-mono text-primary">{m.avgMatches.toFixed(2)}</td>
                          <td className="py-2 pr-4 font-mono text-muted-foreground">{m.bestMatches}</td>
                          <td className="py-2 pr-4 font-mono text-muted-foreground">{m.hitRate.toFixed(0)}%</td>
                          <td className="py-2 font-mono text-muted-foreground">{m.avgPairMatches.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Avg / draw = mean of the model's top-6 numbers that matched the actual draw.
                  Pair matches = combinations within the top-6 pick where both numbers hit.
                </p>
              </Panel>

              <Panel title="Matches over time (last 60 tested draws)">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={active.results.timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      {MODEL_KEYS.map((k, i) => (
                        <Line
                          key={k}
                          type="monotone"
                          dataKey={k}
                          name={active.results.models.find((m) => m.key === k)?.label ?? k}
                          stroke={colors[i % colors.length]}
                          dot={false}
                          strokeWidth={2}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
