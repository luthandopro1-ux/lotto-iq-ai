import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Panel, Ball } from "@/components/AppShell";
import { runAnalysis, rankPairs } from "@/lib/engine";
import { aiInsights } from "@/lib/ai.functions";
import { getAnalysisSnapshot, refreshAnalysisSnapshot } from "@/lib/analysis.functions";
import {
  SESSIONS,
  SESSION_LABELS,
  currentSession,
  drawNumbers,
  type Draw,
  type SessionKey,
  type Strategy,
} from "@/lib/uk49";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrainCircuit, Download, RefreshCw, Save } from "lucide-react";

export const Route = createFileRoute("/analysis")({
  head: () => ({
    meta: [
      { title: "Analysis Engine — Lotto IQ AI" },
      {
        name: "description",
        content:
          "Run every active UK49 strategy against your history, rank candidate numbers by overlap and weight, and get AI insights.",
      },
      { property: "og:title", content: "UK49 Analysis Engine" },
      {
        property: "og:description",
        content: "Candidate numbers ranked by strategy overlap and configurable weights.",
      },
    ],
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const insightsFn = useServerFn(aiInsights);
  const getSnapshotFn = useServerFn(getAnalysisSnapshot);
  const refreshSnapshotFn = useServerFn(refreshAnalysisSnapshot);
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState<SessionKey>(currentSession());

  const snapshotKey = ["analysis-snapshot", date, session];
  const { data: snapshot, isLoading: snapshotLoading } = useQuery({
    queryKey: snapshotKey,
    queryFn: () => getSnapshotFn({ data: { targetDate: date, targetSession: session } }),
  });

  const refresh = useMutation({
    mutationFn: () => refreshSnapshotFn({ data: { targetDate: date, targetSession: session } }),
    onSuccess: (row) => {
      queryClient.setQueryData(snapshotKey, row);
      toast.success("Analysis snapshot saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: draws = [] } = useQuery({
    queryKey: ["draws", "analysis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("draws")
        .select("*")
        .order("draw_date", { ascending: false })
        .limit(300);
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

  const active = useMemo(() => strategies.filter((s) => s.enabled), [strategies]);

  const result = useMemo(() => {
    const history = draws.filter((d) => d.draw_date < date);
    return runAnalysis(active, {
      date: new Date(date),
      session,
      history,
      previousThree: history.slice(0, 3),
    });
  }, [active, draws, date, session]);

  const history = useMemo(() => draws.filter((d) => d.draw_date < date), [draws, date]);
  const pairs = useMemo(() => rankPairs(result.ranked, history), [result, history]);

  const ai = useMutation({
    mutationFn: async () => {
      const summary = [
        `Target draw: ${date} ${SESSION_LABELS[session]}.`,
        `History depth: ${draws.length} draws.`,
        `Active strategies: ${active.map((s) => `${s.name} (weight ${s.weight})`).join(", ")}.`,
        "Top ranked candidates: " +
          result.ranked
            .slice(0, 12)
            .map((r) => `${r.number} score ${r.score.toFixed(1)} from ${r.hits.length} strategies`)
            .join("; "),
        "Top ranked pairs: " +
          pairs
            .map(
              (p) =>
                `${p.pair[0]}+${p.pair[1]} score ${p.score.toFixed(1)}, ${p.sharedStrategies} shared strategies, ${p.coOccurrences} historical co-occurrences`,
            )
            .join("; "),
        "Per-strategy outputs: " +
          result.perStrategy.map((p) => `${p.strategy.name}: [${p.numbers.join(",")}]`).join(" | "),
        "Last five draws: " +
          draws
            .slice(0, 5)
            .map((d) => `${d.draw_date} ${d.session} ${drawNumbers(d).join("-")}`)
            .join(" | "),
      ].join("\n");
      return insightsFn({ data: { summary: summary.slice(0, 60000) } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => {
    const rows = [
      ["number", "score", "strategy_count", "strategies"],
      ...result.ranked.map((r) => [
        r.number,
        r.score.toFixed(2),
        r.hits.length,
        `"${r.hits.map((h) => h.strategy).join("; ")}"`,
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lottoiq-${date}-${session}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">Analysis engine</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every active strategy runs independently, outputs are normalised to 1–49, and numbers
        produced by multiple strategies rank higher.
      </p>

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-xs">Target draw date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Session</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {SESSIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSession(s)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    session === s
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary/60"
                  }`}
                >
                  {SESSION_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={exportCsv} disabled={result.ranked.length === 0}>
              <Download className="mr-2 size-4" />
              CSV
            </Button>
            <Button
              onClick={() => ai.mutate()}
              disabled={ai.isPending || result.ranked.length === 0}
            >
              <BrainCircuit className="mr-2 size-4" />
              {ai.isPending ? "Thinking…" : "AI insights"}
            </Button>
          </div>
        </div>
      </Panel>

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {snapshotLoading ? (
            <p className="text-xs text-muted-foreground">Checking for a saved snapshot…</p>
          ) : snapshot ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-primary">Saved snapshot</span> · top-5 and pairs
              stored{" "}
              {new Date(snapshot.created_at).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              ({snapshot.trigger === "daily-board" ? "auto, after sync" : "manual"}) · not
              recalculated on this page load.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No saved snapshot for this draw yet — the figures below are computed live in your
              browser. Save one so the dashboard and next visit load instantly.
            </p>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending || result.ranked.length === 0}
          >
            {snapshot ? (
              <RefreshCw className="mr-2 size-3.5" />
            ) : (
              <Save className="mr-2 size-3.5" />
            )}
            {refresh.isPending ? "Saving…" : snapshot ? "Recompute & save" : "Save this analysis"}
          </Button>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Ranked candidates" className="lg:col-span-2">
          {result.ranked.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No output — import draws and enable at least one strategy.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                {result.ranked.slice(0, 18).map((r, i) => (
                  <div key={r.number} className="text-center">
                    <Ball
                      n={r.number}
                      variant={i === 0 ? "primary" : i < 6 ? "accent" : "default"}
                    />
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {r.score.toFixed(1)} · {r.hits.length}×
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Score = sum of the weights of every strategy that produced the number.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="AI insights">
          {ai.data ? (
            <div className="space-y-3">
              <p className="font-display text-sm font-semibold">{ai.data.headline}</p>
              {ai.data.insights.map((i, k) => (
                <div key={k} className="rounded-lg border border-border/70 p-3">
                  <p className="text-xs font-semibold text-primary">{i.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
                </div>
              ))}
              <p className="text-[11px] italic text-muted-foreground">{ai.data.caveat}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Run AI insights to get an explanation of strategy overlap, recurring calculations and
              historical trends.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Top 5 ranked pairs" className="mt-6">
        {pairs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not enough candidates yet — run at least two strategies with output.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pairs.map((p, i) => (
              <div key={p.pair.join("-")} className="rounded-xl border border-border/70 p-3">
                <div className="flex items-center gap-3">
                  <Ball n={p.pair[0]} variant={i === 0 ? "primary" : "accent"} />
                  <Ball n={p.pair[1]} variant={i === 0 ? "primary" : "accent"} />
                  <div className="ml-auto text-right">
                    <p className="font-mono text-sm font-semibold">{p.score.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">pair score</p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                  <div className="flex justify-between">
                    <dt>Strategy agreement</dt>
                    <dd className="font-mono">{p.strategyScore.toFixed(1)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Strategies producing both</dt>
                    <dd className="font-mono">{p.sharedStrategies}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Historical co-occurrences</dt>
                    <dd className="font-mono">
                      {p.coOccurrences} ({(p.coOccurrenceRate * 100).toFixed(1)}%)
                    </dd>
                  </div>
                </dl>
                {p.sharedStrategyNames.length > 0 && (
                  <p className="mt-2 text-[11px] text-primary">
                    {p.sharedStrategyNames.slice(0, 3).join(", ")}
                    {p.sharedStrategyNames.length > 3
                      ? ` +${p.sharedStrategyNames.length - 3} more`
                      : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Pair score = combined agreement of both numbers + bonus for strategies that produced both
          + how often the pair has landed together historically.
        </p>
      </Panel>

      <Panel title="Per-strategy output" className="mt-6">
        <div className="space-y-3">
          {result.perStrategy.map((p) => (
            <div key={p.strategy.id} className="rounded-xl border border-border/70 p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold">{p.strategy.name}</span>
                <span className="font-mono text-muted-foreground">
                  {p.numbers.length} numbers · ×{Number(p.strategy.weight).toFixed(1)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.numbers.map((n) => (
                  <Ball key={n} n={n} className="size-8 text-xs" />
                ))}
                {p.numbers.length === 0 && (
                  <span className="text-xs text-muted-foreground">No output for this draw.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
