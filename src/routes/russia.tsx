import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/AppShell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Plus, Play, Flame, Snowflake } from "lucide-react";
import {
  getRussiaGameState,
  addRussiaDraw,
  getRussiaDashboard,
  runRussiaBacktest,
  listRussiaBacktestsFn,
} from "@/lib/russia.functions";

export const Route = createFileRoute("/russia")({
  head: () => ({
    meta: [
      { title: "Russia Lottery — Lotto IQ" },
      {
        name: "description",
        content:
          "AI-ranked predictions with statistical Bankers for Russia 5/50, 6/45 and 7/49 — independent of the UK49 engine.",
      },
    ],
  }),
  component: RussiaPage,
});

const GAMES = [
  { code: "ru_5_50" as const, label: "5/50" },
  { code: "ru_6_45" as const, label: "6/45" },
  { code: "ru_7_49" as const, label: "7/49" },
];

function Ball({ n, variant = "default" }: { n: number; variant?: "default" | "banker" }) {
  return (
    <span
      className={`grid size-10 place-items-center rounded-full font-mono text-sm font-bold ${
        variant === "banker"
          ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
          : "bg-secondary text-foreground"
      }`}
    >
      {n}
    </span>
  );
}

function RussiaPage() {
  const [gameCode, setGameCode] = useState<(typeof GAMES)[number]["code"]>("ru_5_50");

  const stateFn = useServerFn(getRussiaGameState);
  const addDrawFn = useServerFn(addRussiaDraw);
  const dashboardFn = useServerFn(getRussiaDashboard);
  const runBacktestFn = useServerFn(runRussiaBacktest);
  const listBacktestsFn = useServerFn(listRussiaBacktestsFn);
  const queryClient = useQueryClient();

  const stateKey = ["russia", "state", gameCode];
  const { data: state, isLoading } = useQuery({
    queryKey: stateKey,
    queryFn: () => stateFn({ data: { gameCode } }),
  });

  const { data: dashboard } = useQuery({
    queryKey: ["russia", "dashboard", gameCode],
    queryFn: () => dashboardFn({ data: { gameCode } }),
  });

  const { data: backtests = [] } = useQuery({
    queryKey: ["russia", "backtests", gameCode],
    queryFn: () => listBacktestsFn({ data: { gameCode } }),
  });

  const [drawDate, setDrawDate] = useState(new Date().toISOString().slice(0, 10));
  const [drawNumber, setDrawNumber] = useState("");
  const [numbersText, setNumbersText] = useState("");

  const addDraw = useMutation({
    mutationFn: () =>
      addDrawFn({
        data: {
          gameCode,
          drawDate,
          drawNumber: Number(drawNumber),
          winningNumbers: numbersText
            .split(/[\s,]+/)
            .filter(Boolean)
            .map(Number),
        },
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: stateKey });
      queryClient.invalidateQueries({ queryKey: ["russia", "dashboard", gameCode] });
      setDrawNumber("");
      setNumbersText("");
      toast.success(
        result.graded
          ? `Draw saved — ${result.graded.totalHits} hits (${result.graded.bankerHits} Banker hits). Next prediction generated.`
          : "Draw saved. Next prediction generated.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const [btFrom, setBtFrom] = useState(yearAgo);
  const [btTo, setBtTo] = useState(today);
  const runBt = useMutation({
    mutationFn: () => runBacktestFn({ data: { gameCode, dateFrom: btFrom, dateTo: btTo } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["russia", "backtests", gameCode] });
      toast.success("Backtest saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const game = state?.game;

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">🌍 Lotto IQ — Russia</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Independent AI-ranked prediction engines for Russia 5/50, 6/45 and 7/49 — separate history,
        scoring and backtesting from the UK49 engine. Statistical Bankers, not guarantees.
      </p>

      <Tabs
        value={gameCode}
        onValueChange={(v) => setGameCode(v as typeof gameCode)}
        className="mb-6"
      >
        <TabsList>
          {GAMES.map((g) => (
            <TabsTrigger key={g.code} value={g.code}>
              Russia {g.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Next draw" className="lg:col-span-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !state?.pendingPrediction ? (
            <p className="text-sm text-muted-foreground">
              No pending prediction yet — add at least one historical draw below to generate one.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
                Targeting draw #{state.pendingPrediction.targetDrawNumber}
              </p>
              <div className="mb-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  <Lock className="size-3.5" /> Bankers
                </p>
                <div className="flex gap-2">
                  {state.pendingPrediction.bankers.map((n) => (
                    <Ball key={n} n={n} variant="banker" />
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  AI prediction
                </p>
                <div className="flex flex-wrap gap-2">
                  {state.pendingPrediction.predictedNumbers.map((n) => (
                    <Ball
                      key={n}
                      n={n}
                      variant={state.pendingPrediction!.bankers.includes(n) ? "banker" : "default"}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Why these Bankers?
                </p>
                <div className="space-y-2">
                  {state.pendingPrediction.bankers.map((n) => (
                    <div key={n} className="rounded-lg border border-border/60 px-3 py-2 text-xs">
                      <p className="mb-1 font-mono font-semibold text-primary">{n}</p>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {(state.pendingPrediction!.explanation[n] ?? []).map((line, i) => (
                          <li key={i}>• {line}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {state?.lastResult && (
            <div className="mt-5 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              Last graded draw (#{state.lastResult.prediction.targetDrawNumber}):{" "}
              <span className="font-semibold text-foreground">
                {state.lastResult.totalHits} hits, {state.lastResult.bankerHits} Banker hits
              </span>{" "}
              — actual {state.lastResult.actualNumbers.join(", ")}
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Add a draw result">
            <p className="mb-3 text-xs text-muted-foreground">
              No automatic feed is connected for Russian draws yet — enter the official result here
              once it's published. Never guess or simulate a result.
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Draw date</Label>
                <Input type="date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Draw number</Label>
                <Input
                  type="number"
                  value={drawNumber}
                  onChange={(e) => setDrawNumber(e.target.value)}
                  placeholder="e.g. 1042"
                />
              </div>
              <div>
                <Label className="text-xs">
                  Winning numbers ({game?.numbers_drawn ?? "…"} numbers, comma or space separated)
                </Label>
                <Input
                  value={numbersText}
                  onChange={(e) => setNumbersText(e.target.value)}
                  placeholder="e.g. 3, 12, 27, 34, 41"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => addDraw.mutate()}
                disabled={addDraw.isPending || !drawNumber || !numbersText}
              >
                <Plus className="mr-2 size-4" />
                {addDraw.isPending ? "Saving…" : "Save & advance"}
              </Button>
            </div>
          </Panel>

          <Panel title="Recent draws">
            {!state || state.recentDraws.length === 0 ? (
              <p className="text-sm text-muted-foreground">No draws recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {state.recentDraws
                  .slice()
                  .reverse()
                  .map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        #{d.draw_number} · {d.draw_date}
                      </span>
                      <span className="font-mono">{d.winning_numbers.join(" · ")}</span>
                    </div>
                  ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Hot & cold numbers">
          {!dashboard || dashboard.drawsRecorded === 0 ? (
            <p className="text-sm text-muted-foreground">Add history to see this analysis.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
                  <Flame className="size-3.5" /> Hot
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dashboard.hot.map((h) => (
                    <Ball key={h.n} n={h.n} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <Snowflake className="size-3.5" /> Cold
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dashboard.cold.map((c) => (
                    <Ball key={c.n} n={c.n} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Prediction performance">
          {!dashboard || dashboard.performance.gradedCount === 0 ? (
            <p className="text-sm text-muted-foreground">No graded predictions yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {dashboard.performance.avgHits.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">avg hits / draw</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">
                  {dashboard.performance.avgBankerHits.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">avg Banker hits</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">
                  {dashboard.performance.bankerHitRate.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">Banker hit rate</p>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Backtesting" className="mt-6">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={btFrom} onChange={(e) => setBtFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={btTo} onChange={(e) => setBtTo(e.target.value)} />
          </div>
          <Button onClick={() => runBt.mutate()} disabled={runBt.isPending}>
            <Play className="mr-2 size-4" />
            {runBt.isPending ? "Running…" : "Run & save backtest"}
          </Button>
        </div>
        {backtests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No saved backtests yet for Russia {GAMES.find((g) => g.code === gameCode)?.label}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-4">Range</th>
                  <th className="py-2 pr-4">Tests</th>
                  <th className="py-2 pr-4">Avg hits</th>
                  <th className="py-2 pr-4">Best</th>
                  <th className="py-2 pr-4">Avg Banker hits</th>
                  <th className="py-2">Banker hit rate</th>
                </tr>
              </thead>
              <tbody>
                {backtests.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted-foreground">
                      {row.date_from} → {row.date_to}
                    </td>
                    <td className="py-2 pr-4 font-mono">{row.results.metrics.tests}</td>
                    <td className="py-2 pr-4 font-mono text-primary">
                      {row.results.metrics.avgHits.toFixed(2)}
                    </td>
                    <td className="py-2 pr-4 font-mono">{row.results.metrics.bestHits}</td>
                    <td className="py-2 pr-4 font-mono">
                      {row.results.metrics.avgBankerHits.toFixed(2)}
                    </td>
                    <td className="py-2 font-mono">
                      {row.results.metrics.bankerHitRate.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
