import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, Ball, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { runDailyBoard } from "@/lib/predict.functions";
import { SESSION_LABELS, SESSIONS, type SessionKey } from "@/lib/uk49";
import type { Grading, PickedNumber, PredictionRow } from "@/lib/predict";
import { SyncLog } from "@/components/SyncLog";
import { AdaptivePanel } from "@/components/AdaptivePanel";
import { RefreshCw } from "lucide-react";

const STATE_STYLE: Record<string, string> = {
  WAITING: "bg-secondary/60 text-muted-foreground",
  PREDICTION_READY: "bg-primary/15 text-primary",
  DRAW_PENDING: "bg-amber-500/15 text-amber-400",
  RESULT_DETECTED: "bg-sky-500/15 text-sky-400",
  RESULT_VERIFIED: "bg-sky-500/15 text-sky-400",
  ANALYZED: "bg-emerald-500/15 text-emerald-400",
};

function StateBadge({ state }: { state: string }) {
  return (
    <span
      className={`rounded-lg px-2 py-1 text-[10px] font-semibold tracking-wide ${
        STATE_STYLE[state] ?? "bg-secondary/60"
      }`}
    >
      {state.replace(/_/g, " ")}
    </span>
  );
}

export const Route = createFileRoute("/predictions")({
  head: () => ({
    meta: [
      { title: "Daily Prediction Chart — Lotto IQ" },
      {
        name: "description",
        content:
          "Banker, pairs and bonus selections generated before every UK49s draw, graded HIT or MISS against the actual result.",
      },
      { property: "og:title", content: "UK49s Daily Banker / Pairs / Bonus chart" },
      {
        property: "og:description",
        content:
          "Four draws a day, all strategies combined, every selection graded against the real result.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PredictionsPage,
});

const pad = (n: number) => String(n).padStart(2, "0");

function Names({ p }: { p: PickedNumber }) {
  if (p.strategies.length === 0) return null;
  return (
    <span className="text-[10px] text-muted-foreground">
      {p.strategies.slice(0, 2).join(", ")}
      {p.strategies.length > 2 ? ` +${p.strategies.length - 2}` : ""}
    </span>
  );
}

function Flag({ hit }: { hit: boolean | null }) {
  if (hit === null) return <span className="text-[10px] text-muted-foreground">—</span>;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        hit ? "bg-primary/20 text-primary" : "bg-destructive/15 text-destructive"
      }`}
    >
      {hit ? "✓ HIT" : "✗ MISS"}
    </span>
  );
}

function Chart({ rows, grading }: { rows: PredictionRow[]; grading: Grading | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
            <th className="pb-2">Banker</th>
            <th className="pb-2">Pairs</th>
            <th className="pb-2">Bonus</th>
            <th className="pb-2 text-right">Result</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((r, i) => {
            const g = grading?.rows[i] ?? null;
            return (
              <tr key={i} className="border-t border-border/60 align-top">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <Ball
                      n={r.banker.n}
                      variant={g?.bankerHit ? "matched" : "default"}
                      className="!size-8 !text-xs"
                    />
                    {g && <Flag hit={g.bankerHit} />}
                  </div>
                  <Names p={r.banker} />
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <Ball
                      n={r.pair[0].n}
                      variant={g?.pairHits[0] ? "matched" : "default"}
                      className="!size-8 !text-xs"
                    />
                    <span className="text-muted-foreground">--</span>
                    <Ball
                      n={r.pair[1].n}
                      variant={g?.pairHits[1] ? "matched" : "default"}
                      className="!size-8 !text-xs"
                    />
                    {g && <Flag hit={g.pairHits[0] || g.pairHits[1]} />}
                  </div>
                  <Names p={r.pair[1]} />
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <Ball
                      n={r.bonus.n}
                      variant={g?.bonusHit ? "matched" : "default"}
                      className="!size-8 !text-xs"
                    />
                    {g && <Flag hit={g.bonusHit} />}
                  </div>
                  <Names p={r.bonus} />
                </td>
                <td className="py-2 text-right text-[11px] text-muted-foreground">
                  {g
                    ? g.pairFullHit
                      ? "pair complete"
                      : g.bankerHit
                        ? "banker in"
                        : ""
                    : "pending"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PredictionsPage() {
  const run = useServerFn(runDailyBoard);
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState<SessionKey | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["daily-board", date],
    queryFn: () => run({ data: { date, sync: true } }),
    // Poll hard while a draw is landing, idle the rest of the time.
    refetchInterval: (q) =>
      (q.state.data?.board ?? []).some(
        (b) => b.state === "DRAW_PENDING" || b.state === "RESULT_DETECTED",
      )
        ? 30_000
        : 5 * 60 * 1000,
  });

  const refresh = useMutation({
    mutationFn: () => run({ data: { date, sync: true } }),
    onSuccess: (d) => {
      qc.setQueryData(["daily-board", date], d);
      toast.success("Synced and recalculated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const board = data?.board ?? [];

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Daily prediction chart</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            UK49s runs four draws a day — Brunch → Lunch → Drive Time → Tea Time. Before each one
            the engine syncs results, runs every active strategy over the full daily sequence and
            saves a Banker / Pairs / Bonus chart. After the draw each selection is graded and the
            misses feed the next session.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <Button onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className={`mr-2 size-4 ${refresh.isPending ? "animate-spin" : ""}`} />
            Sync & recalc
          </Button>
        </div>
      </div>

      {data && (
        <Panel className="mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Active strategies</p>
              <p className="font-display text-xl font-bold">{data.strategyCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">History depth</p>
              <p className="font-display text-xl font-bold">{data.historyDepth}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Graded draws learned from</p>
              <p className="font-display text-xl font-bold">{data.learning.sampleSize}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Carried-forward misses</p>
              <p className="font-mono text-xs">
                {data.learning.recentMisses.slice(0, 14).map(pad).join(" ") || "none yet"}
              </p>
            </div>
          </div>
        </Panel>
      )}

      {data && data.catchUp.stillMissing.length > 0 && (
        <Panel className="mb-6 border-amber-500/40">
          <p className="text-sm font-semibold text-amber-400">Missing draws detected</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {data.catchUp.stillMissing.join(" · ")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The engine will keep retrying these and will not predict past a session whose result is
            still unverified.
          </p>
        </Panel>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Syncing latest draws…</p>}

      <div className="space-y-6">
        {SESSIONS.map((session) => {
          const slot = board.find((b) => b.session === session);
          const p = slot?.prediction ?? null;
          const grading = (p?.grading ?? null) as Grading | null;
          const rows = (p?.rows ?? []) as unknown as PredictionRow[];
          const drawn = slot?.draw ?? null;

          return (
            <Panel
              key={session}
              title={`${SESSION_LABELS[session]} — ${slot?.ukTime ?? ""} UK · ${slot?.drawId ?? date}`}
              action={
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <StateBadge state={slot?.state ?? "WAITING"} />
                  {p?.outcome && (
                    <span className="rounded-lg bg-secondary/60 px-2 py-1 font-semibold">
                      {p.outcome}
                    </span>
                  )}
                  {grading ? (
                    <span className="rounded-lg bg-primary/15 px-2 py-1 font-semibold text-primary">
                      {grading.matched} of {p?.pool.length ?? 0} candidates hit
                    </span>
                  ) : drawn ? (
                    <span className="text-muted-foreground">drawn, no saved prediction</span>
                  ) : (
                    <span className="rounded-lg bg-secondary/60 px-2 py-1">awaiting draw</span>
                  )}
                  {rows.length > 0 && (
                    <button
                      onClick={() => setOpen(open === session ? null : session)}
                      className="text-primary"
                    >
                      {open === session ? "Hide working" : "Show working"}
                    </button>
                  )}
                </div>
              }
            >
              {drawn && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Actual:</span>
                  {drawn.numbers.map((number) => (
                    <Ball
                      key={number}
                      n={number}
                      variant={p?.pool.some((picked) => picked.n === number) ? "matched" : "accent"}
                      className="!size-7 !text-[10px]"
                    />
                  ))}
                  {drawn.booster != null && (
                    <Ball
                      n={drawn.booster}
                      variant="accent"
                      className="!size-7 !text-[10px]"
                      title={`UK49 booster ${drawn.booster}`}
                    />
                  )}
                </div>
              )}

              {p && (
                <p className="mb-3 text-xs text-muted-foreground">
                  Target:{" "}
                  <span className="font-semibold text-foreground">
                    {p.target_date} {SESSION_LABELS[p.target_session]}
                  </span>
                  {p.history_cutoff_date && p.history_cutoff_session
                    ? ` · History through ${p.history_cutoff_date} ${SESSION_LABELS[p.history_cutoff_session]}`
                    : " · Legacy cutoff metadata unavailable"}
                  {p.model_version ? ` · ${p.model_version}` : ""}
                </p>
              )}

              {slot?.blockedReason && (
                <p className="mb-3 text-xs text-amber-400">Waiting: {slot.blockedReason}</p>
              )}

              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {drawn
                    ? "This draw already landed before a prediction was saved — nothing is back-dated."
                    : "No prediction yet. Enable at least one strategy and sync."}
                </p>
              ) : (
                <>
                  <Chart rows={rows} grading={grading} />
                  {open === session && (
                    <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Strategy contribution
                      </p>
                      {Array.from(
                        new Map(
                          rows.flatMap((r) => [r.banker, r.pair[1], r.bonus]).map((x) => [x.n, x]),
                        ).values(),
                      )
                        .sort((a, b) => b.score - a.score)
                        .map((x) => (
                          <div key={x.n} className="flex flex-wrap items-baseline gap-2 text-xs">
                            <Ball
                              n={x.n}
                              variant={grading?.actual.includes(x.n) ? "matched" : "default"}
                              className="!size-8 !text-[10px]"
                            />
                            <span className="text-muted-foreground">score {x.score}</span>
                            <span className="text-primary">{x.strategies.join(", ")}</span>
                            {grading && <Flag hit={grading.actual.includes(x.n)} />}
                          </div>
                        ))}
                    </div>
                  )}
                </>
              )}
            </Panel>
          );
        })}
      </div>

      <div className="mt-6">
        <AdaptivePanel date={date} session={data?.nextTarget.session ?? "brunch"} />
      </div>

      <div className="mt-6">
        <SyncLog />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Predictions are saved before the draw and never rewritten afterwards. Grading compares the
        saved selections with the real published result.
      </p>
    </AppShell>
  );
}
