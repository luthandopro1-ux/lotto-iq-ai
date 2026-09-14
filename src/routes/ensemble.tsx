import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Panel, Ball } from "@/components/AppShell";
import { buildPrediction } from "@/lib/predict";
import { computeStats } from "@/lib/stats";
import {
  buildEnsemble,
  scoreComponents,
  searchWeights,
  CLASS_STYLE,
  type Classification,
} from "@/lib/ensemble";
import {
  SESSIONS,
  SESSION_LABELS,
  currentSession,
  drawNumbers,
  type Draw,
  type SessionKey,
  type Strategy,
} from "@/lib/uk49";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/ensemble")({
  head: () => ({
    meta: [
      { title: "Ensemble Confirmation — Lotto IQ AI" },
      {
        name: "description",
        content:
          "Your UK49 strategy formula stays the core engine while a statistical layer of frequency, EMA, gap, Z-score, Bayesian, Markov and Monte Carlo models confirms or challenges each candidate.",
      },
      { property: "og:title", content: "UK49 Ensemble Confirmation Layer" },
      {
        property: "og:description",
        content:
          "Formula 70% / statistics 30% — every candidate classified CONFIRMED, SUPPORTED, FORMULA ONLY, STATISTICAL ONLY or CONFLICT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EnsemblePage,
});

const pad = (n: number) => String(n).padStart(2, "0");
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Tag({ c }: { c: Classification }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CLASS_STYLE[c]}`}>{c}</span>
  );
}

function EnsemblePage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState<SessionKey>(currentSession());
  const [weight, setWeight] = useState(0.7);

  const { data: draws = [], isLoading } = useQuery({
    queryKey: ["draws", "ensemble"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("draws")
        .select("*")
        .order("draw_date", { ascending: false })
        .limit(400);
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

  /* STEP 1-2 — the existing formula runs exactly as designed. */
  const prediction = useMemo(
    () => buildPrediction(active, { targetDate: date, targetSession: session, history: draws }),
    [active, date, session, draws],
  );

  /* STEP 3 — the additional statistical layer, on the same history. */
  const stats = useMemo(() => {
    const history = draws.filter(
      (d) =>
        d.draw_date < date ||
        (d.draw_date === date && SESSIONS.indexOf(d.session) < SESSIONS.indexOf(session)),
    );
    return computeStats(history);
  }, [draws, date, session]);

  /* STEP 4-9 — comparison, classification, ensemble score. */
  const ensemble = useMemo(
    () => buildEnsemble(prediction, stats, weight),
    [prediction, stats, weight],
  );

  /* STEP 10 — component scoreboard over already-drawn slots (no future info). */
  const scoreEntries = useMemo(() => {
    if (draws.length < 20 || active.length === 0) return [];
    const ordered = [...draws].sort((a, b) =>
      a.draw_date === b.draw_date
        ? SESSIONS.indexOf(b.session) - SESSIONS.indexOf(a.session)
        : a.draw_date < b.draw_date
          ? 1
          : -1,
    );
    return ordered.slice(0, 12).map((d) => {
      const before = ordered.filter(
        (x) =>
          x.draw_date < d.draw_date ||
          (x.draw_date === d.draw_date &&
            SESSIONS.indexOf(x.session) < SESSIONS.indexOf(d.session)),
      );
      const p = buildPrediction(active, {
        targetDate: d.draw_date,
        targetSession: d.session,
        history: before,
      });
      return {
        label: `${d.draw_date} ${SESSION_LABELS[d.session]}`,
        formulaPool: p.pool,
        stats: computeStats(before, { simulations: 500 }),
        draw: d,
      };
    });
  }, [draws, active]);

  const scoreboard = useMemo(() => scoreComponents(scoreEntries, weight), [scoreEntries, weight]);
  const ratios = useMemo(() => searchWeights(scoreEntries), [scoreEntries]);

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">Ensemble confirmation</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Your existing strategy formula is the core engine and runs untouched. The statistical layer
        — weighted frequency, EMA momentum, gap, Z-score, Bayesian, pair and triplet association,
        Markov transitions, Monte Carlo and entropy — is an additional validation layer. It never
        replaces a formula candidate; it only confirms, supports or flags a conflict.
      </p>

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end gap-5">
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
          <div className="min-w-[220px] flex-1">
            <Label className="text-xs">
              Ensemble weighting — formula {pct(weight)} / statistics {pct(1 - weight)}
            </Label>
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.05}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="mt-3 w-full accent-primary"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Starts at 70 / 30. Change it only when the out-of-sample table below shows a better
              ratio.
            </p>
          </div>
        </div>
      </Panel>

      {isLoading && <p className="text-sm text-muted-foreground">Loading history…</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Step 2 — existing formula board" className="lg:col-span-2">
          {prediction.pool.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No formula output — enable at least one strategy and import draws.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-3">
                {prediction.pool.slice(0, 14).map((p, i) => (
                  <div key={p.n} className="text-center">
                    <Ball n={p.n} variant={i === 0 ? "primary" : i < 5 ? "accent" : "default"} />
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{p.score}</p>
                  </div>
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Banker</dt>
                  <dd className="font-mono text-base font-bold">
                    {prediction.bankers[0] ? pad(prediction.bankers[0].n) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Pairs</dt>
                  <dd className="font-mono">{prediction.rows.length}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Pool size</dt>
                  <dd className="font-mono">{prediction.pool.length}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">History depth</dt>
                  <dd className="font-mono">{prediction.history_depth}</dd>
                </div>
              </dl>
            </>
          )}
        </Panel>

        <Panel title="Step 8 — banker verdict">
          <p className="font-mono text-3xl font-bold">
            {ensemble.banker.banker ? pad(ensemble.banker.banker.n) : "—"}
          </p>
          <p
            className={`mt-2 inline-block rounded px-2 py-1 text-[11px] font-semibold ${
              ensemble.banker.status === "STRONG CONFIRMED BANKER"
                ? "bg-emerald-500/15 text-emerald-400"
                : ensemble.banker.status === "BANKER CONFLICT"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/15 text-primary"
            }`}
          >
            {ensemble.banker.status}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">{ensemble.banker.note}</p>
          <dl className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            <div className="flex justify-between">
              <dt>Statistical rank of formula banker</dt>
              <dd className="font-mono">{ensemble.banker.statRank ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Statistical challenger (not applied)</dt>
              <dd className="font-mono">
                {ensemble.banker.challenger ? pad(ensemble.banker.challenger) : "—"}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      <Panel title="Step 5 — candidate classification" className="mt-6">
        <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
          {(Object.keys(ensemble.counts) as Classification[]).map((c) => (
            <span key={c} className={`rounded px-2 py-1 font-semibold ${CLASS_STYLE[c]}`}>
              {c} · {ensemble.counts[c]}
            </span>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="text-left uppercase tracking-widest text-muted-foreground">
                <th className="pb-2">No.</th>
                <th className="pb-2">Formula</th>
                <th className="pb-2">Statistical</th>
                <th className="pb-2">Agreement</th>
                <th className="pb-2">Ensemble</th>
                <th className="pb-2">Class</th>
                <th className="pb-2">Strategies</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {ensemble.candidates.slice(0, 24).map((c) => (
                <tr key={c.n} className="border-t border-border/60">
                  <td className="py-2 text-base font-bold">{pad(c.n)}</td>
                  <td className="py-2">
                    {c.inFormula ? `${pct(c.formulaScore)} · #${c.formulaRank}` : "—"}
                  </td>
                  <td className="py-2">
                    {pct(c.statScore)} · #{c.statRank}
                  </td>
                  <td className="py-2">{pct(c.agreement)}</td>
                  <td className="py-2 font-bold">{pct(c.ensembleScore)}</td>
                  <td className="py-2">
                    <Tag c={c.classification} />
                  </td>
                  <td className="max-w-[220px] truncate py-2 font-sans text-[11px] text-primary">
                    {c.strategies.join(", ") || "statistical layer only"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Formula candidates are always listed first — a statistical-only number never displaces
          one, it is only shown as a watch item.
        </p>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Step 9 — pairs (formula first)">
          <div className="space-y-2">
            {ensemble.pairs.slice(0, 10).map((p) => (
              <div
                key={p.pair.join("-")}
                className="flex items-center gap-3 rounded-lg border border-border/70 p-2 text-xs"
              >
                <span className="font-mono text-base font-bold">
                  {pad(p.pair[0])}--{pad(p.pair[1])}
                </span>
                <Tag c={p.classification} />
                <span className="ml-auto font-mono text-muted-foreground">
                  {p.statCount} together · lift {p.statLift.toFixed(2)}
                </span>
              </div>
            ))}
            {ensemble.pairs.length === 0 && (
              <p className="text-sm text-muted-foreground">No pairs yet.</p>
            )}
          </div>
        </Panel>

        <Panel title="Step 9 — triplets">
          <div className="space-y-2">
            {ensemble.triplets.map((t) => (
              <div
                key={`${t.source}-${t.triplet.join("-")}`}
                className="flex items-center gap-3 rounded-lg border border-border/70 p-2 text-xs"
              >
                <span className="font-mono text-base font-bold">
                  {t.triplet.map(pad).join("--")}
                </span>
                <Tag c={t.classification} />
                <span className="ml-auto font-mono text-muted-foreground">
                  assoc {pct(t.statScore)}
                </span>
              </div>
            ))}
            {ensemble.triplets.length === 0 && (
              <p className="text-sm text-muted-foreground">No triplets yet.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Step 3 — statistical model detail" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="text-left uppercase tracking-widest text-muted-foreground">
                <th className="pb-2">No.</th>
                <th className="pb-2">W. freq</th>
                <th className="pb-2">EMA</th>
                <th className="pb-2">Gap</th>
                <th className="pb-2">Z</th>
                <th className="pb-2">Bayes</th>
                <th className="pb-2">Markov</th>
                <th className="pb-2">Monte Carlo</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {stats.numbers.slice(0, 12).map((s) => (
                <tr key={s.n} className="border-t border-border/60">
                  <td className="py-2 text-base font-bold">{pad(s.n)}</td>
                  <td className="py-2">{pct(s.weightedFreq)}</td>
                  <td className="py-2">{pct(s.ema)}</td>
                  <td className="py-2">
                    {s.detail.gapDraws ?? "—"}/{s.detail.expectedGap.toFixed(1)}
                  </td>
                  <td className="py-2">{s.detail.zRaw.toFixed(2)}</td>
                  <td className="py-2">{(s.detail.posterior * 100).toFixed(1)}%</td>
                  <td className="py-2">{(s.detail.markovRaw * 100).toFixed(1)}%</td>
                  <td className="py-2">{(s.detail.mcProbability * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Sample {stats.sample} draws · entropy {stats.entropy.value.toFixed(3)} of{" "}
          {stats.entropy.max.toFixed(3)} ({pct(stats.entropy.ratio)} of maximum randomness).
        </p>
      </Panel>

      <Panel title="Step 10 — component scoreboard (out-of-sample)" className="mt-6">
        {scoreEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Needs at least 20 stored draws and one active strategy.
          </p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Formula hits</p>
                <p className="font-display text-xl font-bold">{scoreboard.totals.formula}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Statistical hits</p>
                <p className="font-display text-xl font-bold">{scoreboard.totals.statistical}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Combined hits</p>
                <p className="font-display text-xl font-bold">{scoreboard.totals.combined}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Best component</p>
                <p className="font-display text-xl font-bold uppercase">{scoreboard.best}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-widest text-muted-foreground">
                    <th className="pb-2">Draw</th>
                    <th className="pb-2">Formula</th>
                    <th className="pb-2">Statistical</th>
                    <th className="pb-2">Combined</th>
                    <th className="pb-2">Actual</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {scoreboard.rows.map((r) => (
                    <tr key={r.label} className="border-t border-border/60">
                      <td className="py-2 font-sans">{r.label}</td>
                      <td className="py-2">{r.formulaHits}/6</td>
                      <td className="py-2">{r.statHits}/6</td>
                      <td className="py-2">{r.combinedHits}/6</td>
                      <td className="py-2 text-muted-foreground">{r.actual.map(pad).join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              {ratios.map((r) => (
                <span
                  key={r.ratio}
                  className={`rounded px-2 py-1 font-mono ${
                    r.ratio === weight ? "bg-primary/15 text-primary" : "bg-secondary/60"
                  }`}
                >
                  {pct(r.ratio)} formula → {r.hits} hits
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Every row is scored using only draws that happened before it, so no future information
              leaks into the weighting search. The formula weighting changes only when this table
              shows sustained improvement.
            </p>
          </>
        )}
      </Panel>

      <p className="mt-6 text-xs text-muted-foreground">
        Core engine: your strategy formula. Statistical models: validation and enhancement.
        Backtesting: performance judge. Actual draws: feedback. The original strategy is never
        overwritten by a differing statistical ranking.
      </p>
    </AppShell>
  );
}
