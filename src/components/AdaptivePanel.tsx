import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Panel } from "@/components/AppShell";
import { adaptiveReport } from "@/lib/adaptive.functions";
import type { SessionKey } from "@/lib/uk49";

const pad = (n: number) => String(n).padStart(2, "0");

const TREND: Record<string, string> = { up: "↑", flat: "→", down: "↓" };
const TREND_STYLE: Record<string, string> = {
  up: "text-emerald-400",
  flat: "text-muted-foreground",
  down: "text-rose-400",
};

const dot = (score: number) => (score >= 65 ? "🟢" : score >= 45 ? "🟡" : "🔴");

const CONFIDENCE: Record<string, string> = {
  high: "text-emerald-400",
  medium: "text-amber-400",
  low: "text-rose-400",
};

/**
 * Adaptive intelligence read-out. Purely additive: it measures how the
 * existing formula's strategies have been behaving out of sample and never
 * overrides the saved prediction.
 */
export function AdaptivePanel({ date, session }: { date: string; session: SessionKey }) {
  const fn = useServerFn(adaptiveReport);
  const { data, isLoading } = useQuery({
    queryKey: ["adaptive", date, session],
    queryFn: () => fn({ data: { date, session } }),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Panel title="Adaptive engine">
        <p className="text-sm text-muted-foreground">Replaying the last draws walk-forward…</p>
      </Panel>
    );
  }
  if (!data) {
    return (
      <Panel title="Adaptive engine">
        <p className="text-sm text-muted-foreground">
          Not enough stored draws or enabled strategies yet.
        </p>
      </Panel>
    );
  }

  const strongest = data.strategies[0];
  const confirmation = data.strategies[1];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel
        title="Adaptive engine"
        action={
          <span className={`text-xs font-semibold ${CONFIDENCE[data.confidenceLabel]}`}>
            Model confidence {data.confidence}/100 · {data.confidenceLabel.toUpperCase()}
          </span>
        }
      >
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="flex-1">Strategy</span>
          <span className="w-8 text-right">All</span>
          <span className="w-8 text-right">365d</span>
          <span className="w-8 text-right">90d</span>
          <span className="w-8 text-right">30d</span>
          <span className="w-10 text-right">Score</span>
        </div>
        <div className="space-y-2">
          {data.strategies.slice(0, 8).map((s) => (
            <div key={s.strategyId} className="flex items-center gap-2 text-xs">
              <span>{dot(s.score)}</span>
              <span className="flex-1 truncate">{s.strategy}</span>
              <span className={TREND_STYLE[s.trend]}>{TREND[s.trend]}</span>
              <span className="w-8 text-right font-mono text-muted-foreground">
                {Math.round(s.windows.allTime * 100)}
              </span>
              <span className="w-8 text-right font-mono text-muted-foreground">
                {Math.round(s.windows.d365 * 100)}
              </span>
              <span className="w-8 text-right font-mono text-muted-foreground">
                {Math.round(s.windows.d90 * 100)}
              </span>
              <span className="w-8 text-right font-mono text-muted-foreground">
                {Math.round(s.windows.d30 * 100)}
              </span>
              <span className="w-10 text-right font-mono font-bold">{s.score.toFixed(0)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Weighted 40% all-time · 25% one year · 20% 90 days · 15% 30 days, plus date, draw-time,
          lag and confirmation strength.
        </p>

        <div className="mt-4 space-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <p>
            Current strongest: <span className="text-primary">{strongest?.strategy ?? "—"}</span>
          </p>
          <p>
            Current confirmation:{" "}
            <span className="text-primary">{confirmation?.strategy ?? "—"}</span>
          </p>
          <p>Walk-forward slots replayed: {data.slots}</p>
        </div>

        {data.numbers.length > 0 && (
          <div className="mt-4 border-t border-border/60 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Adaptive number ranking (support only)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.numbers.slice(0, 10).map((n) => (
                <span
                  key={n.n}
                  className="rounded-lg bg-secondary/60 px-2 py-1 font-mono text-xs"
                  title={n.strategies.join(", ")}
                >
                  {pad(n.n)} <span className="text-muted-foreground">{n.score}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="Result evaluation"
        action={
          data.evaluatedDraw && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {data.evaluatedDraw.date} · {data.evaluatedDraw.sessionLabel}
            </span>
          )
        }
      >
        {data.evaluatedDraw ? (
          <>
            <p className="mb-3 font-mono text-xs text-muted-foreground">
              Actual: {data.evaluatedDraw.numbers.map(pad).join(" · ")}
            </p>
            <div className="space-y-2">
              {data.evaluation.slice(0, 8).map((e) => (
                <div key={e.strategyId} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">{e.strategy}</span>
                  <span className="text-muted-foreground">
                    predicted {e.predicted} · matched {e.matched}
                  </span>
                  <span className={TREND_STYLE[e.performance]}>{TREND[e.performance]}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No completed draw to evaluate yet.</p>
        )}
      </Panel>
    </div>
  );
}
