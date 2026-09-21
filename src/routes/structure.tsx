import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Panel, Ball } from "@/components/AppShell";
import {
  WHEEL_GROUPS,
  WHEEL_KEYS,
  FAMILY_GROUPS,
  SECTION_GROUPS,
  structuralSequence,
  activeGroups,
  keysOf,
  type StructureKind,
} from "@/lib/structure";
import {
  buildTransitions,
  numbersAfterGroup,
  whatPlayedFirst,
  structuralSupport,
  EVIDENCE_STYLE,
} from "@/lib/transitions";
import { dateIntelligence } from "@/lib/date-intel";
import { SESSION_LABELS, type Draw, type Strategy } from "@/lib/uk49";

export const Route = createFileRoute("/structure")({
  head: () => ({
    meta: [
      { title: "Dream Wheel & Structure — Lotto IQ" },
      {
        name: "description",
        content:
          "UK49 structural intelligence: the +8 Dream Wheel, number families, digital-root sections, transition matrices, what-played-first testing and date intelligence.",
      },
      { property: "og:title", content: "UK49 Dream Wheel & Structural Intelligence" },
      {
        property: "og:description",
        content:
          "Wheel, family and section transitions measured out of sample alongside your existing prediction formula.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StructurePage,
});

const KIND_LABEL: Record<StructureKind, string> = {
  wheel: "Dream Wheel",
  family: "Family",
  section: "Section",
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const num = (v: number) => v.toFixed(2);

function StructurePage() {
  const [kind, setKind] = useState<StructureKind>("wheel");

  const { data: draws = [], isLoading } = useQuery({
    queryKey: ["draws", "structure"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("draws")
        .select("*")
        .order("draw_date", { ascending: false })
        .limit(500);
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

  const sequence = useMemo(() => structuralSequence(draws), [draws]);
  const last = sequence[sequence.length - 1];
  const active = useMemo(() => activeGroups(kind, sequence), [kind, sequence]);
  const matrix = useMemo(
    () => (sequence.length > 5 ? buildTransitions(sequence, kind, kind) : null),
    [sequence, kind],
  );
  const support = useMemo(
    () => (sequence.length > 10 ? structuralSupport(sequence) : null),
    [sequence],
  );
  const leads = useMemo(() => (sequence.length > 40 ? whatPlayedFirst(sequence) : []), [sequence]);
  const intel = useMemo(() => {
    const enabled = strategies.filter((s) => s.enabled);
    if (sequence.length < 20 || enabled.length === 0) return null;
    return dateIntelligence(enabled, sequence, 40);
  }, [strategies, sequence]);

  const topFollowers = useMemo(() => {
    const first = active[0];
    if (!first || sequence.length < 20) return [];
    return numbersAfterGroup(sequence, kind, first.key).slice(0, 10);
  }, [active, sequence, kind]);

  const supportRank = useMemo(() => {
    if (!support) return [];
    return Array.from({ length: 49 }, (_, i) => i + 1)
      .map((n) => ({
        n,
        score: ((support.wheel[n] ?? 0) + (support.family[n] ?? 0) + (support.section[n] ?? 0)) / 3,
        wheel: support.wheel[n] ?? 0,
        family: support.family[n] ?? 0,
        section: support.section[n] ?? 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [support]);

  const groups =
    kind === "wheel" ? WHEEL_GROUPS : kind === "family" ? FAMILY_GROUPS : SECTION_GROUPS;
  const activeKeys = new Set(active.map((a) => a.key));

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">Structural intelligence</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        The Dream Wheel (+8), number families (final digit) and sections (digital root) are an
        additional structural layer. They describe and test structure — your existing formula
        remains the core prediction engine.
      </p>

      {isLoading && <Panel>Loading history…</Panel>}

      {!isLoading && (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2">
            {(["wheel", "family", "section"] as StructureKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  kind === k
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-secondary/60"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {sequence.length} draws analysed
              {last ? ` · latest ${last.date} ${SESSION_LABELS[last.session] ?? last.session}` : ""}
            </span>
          </div>

          <Panel title={`${KIND_LABEL[kind]} map`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {keysOf(kind).map((key) => {
                const isActive = activeKeys.has(key);
                const hit = active.find((a) => a.key === key);
                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-3 ${
                      isActive ? "border-primary/40 bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-display text-sm font-semibold">{key}</span>
                      {hit && (
                        <span className="text-[10px] font-semibold text-primary">
                          ACTIVE · {hit.count} hit{hit.count === 1 ? "" : "s"} ·{" "}
                          {pct(hit.recentRate)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(groups[key] ?? []).map((n) => (
                        <Ball
                          key={n}
                          n={n}
                          variant={hit?.hits.includes(n) ? "primary" : "default"}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {kind === "wheel" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Each wheel group follows the +8 relationship across {WHEEL_KEYS.length} groups.
              </p>
            )}
          </Panel>

          {matrix && (
            <Panel title={`${KIND_LABEL[kind]} → ${KIND_LABEL[kind]} transitions (next draw)`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Active</th>
                      <th className="p-2 text-left">Strongest follower</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">Lift</th>
                      <th className="p-2 text-right">Recent</th>
                      <th className="p-2 text-right">Sample</th>
                      <th className="p-2 text-right">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keysOf(kind).map((key) => {
                      const best = matrix.byFrom[key]?.[0];
                      if (!best) return null;
                      return (
                        <tr
                          key={key}
                          className={`border-t border-border/50 ${
                            activeKeys.has(key) ? "bg-primary/5" : ""
                          }`}
                        >
                          <td className="p-2 font-medium">{key}</td>
                          <td className="p-2">{best.to}</td>
                          <td className="p-2 text-right">{pct(best.adjusted)}</td>
                          <td className="p-2 text-right">{num(best.lift)}×</td>
                          <td className="p-2 text-right">{pct(best.recentRate)}</td>
                          <td className="p-2 text-right">{best.sample}</td>
                          <td className="p-2 text-right">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${EVIDENCE_STYLE[best.evidence]}`}
                            >
                              {best.evidence}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {topFollowers.length > 0 && active[0] && (
            <Panel title={`Numbers that historically follow ${active[0].key}`}>
              <div className="flex flex-wrap gap-2">
                {topFollowers.map((t) => (
                  <div
                    key={t.number}
                    className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5"
                  >
                    <Ball n={t.number} variant="accent" />
                    <span className="text-xs text-muted-foreground">
                      {num(t.lift)}× · {pct(t.adjusted)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Candidate generation only — these numbers are offered to the formula, never
                substituted for it.
              </p>
            </Panel>
          )}

          {supportRank.length > 0 && (
            <Panel title="Combined structural support">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Number</th>
                      <th className="p-2 text-right">Wheel</th>
                      <th className="p-2 text-right">Family</th>
                      <th className="p-2 text-right">Section</th>
                      <th className="p-2 text-right">Combined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supportRank.map((r) => (
                      <tr key={r.n} className="border-t border-border/50">
                        <td className="p-2">
                          <Ball n={r.n} />
                        </td>
                        <td className="p-2 text-right">{pct(r.wheel)}</td>
                        <td className="p-2 text-right">{pct(r.family)}</td>
                        <td className="p-2 text-right">{pct(r.section)}</td>
                        <td className="p-2 text-right font-semibold text-primary">
                          {pct(r.score)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {leads.length > 0 && (
            <Panel title="What played first? (out-of-sample)">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Leads</th>
                      <th className="p-2 text-left">Follows</th>
                      <th className="p-2 text-right">Accuracy</th>
                      <th className="p-2 text-right">Lift</th>
                      <th className="p-2 text-right">Tests</th>
                      <th className="p-2 text-right">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr key={`${l.from}-${l.to}`} className="border-t border-border/50">
                        <td className="p-2 font-medium">{KIND_LABEL[l.from]}</td>
                        <td className="p-2">{KIND_LABEL[l.to]}</td>
                        <td className="p-2 text-right">{pct(l.accuracy)}</td>
                        <td className="p-2 text-right">{num(l.predictiveLift)}×</td>
                        <td className="p-2 text-right">{l.sample}</td>
                        <td className="p-2 text-right">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${EVIDENCE_STYLE[l.evidence]}`}
                          >
                            {l.evidence}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Matrices are trained on the first 70% of history and scored on the remaining 30%.
              </p>
            </Panel>
          )}

          {intel && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Formula performance & lag">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left">Strategy</th>
                        <th className="p-2 text-right">Avg matches</th>
                        <th className="p-2 text-right">Hit rate</th>
                        <th className="p-2 text-right">Avg lag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intel.perStrategy.slice(0, 10).map((s) => (
                        <tr key={s.strategyId} className="border-t border-border/50">
                          <td className="p-2">{s.strategy}</td>
                          <td className="p-2 text-right">{num(s.avgMatches)}</td>
                          <td className="p-2 text-right">{pct(s.hitRate)}</td>
                          <td className="p-2 text-right">{num(s.avgLag)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Replayed over {intel.slots} slots — each slot only sees earlier draws.
                </p>
              </Panel>

              <Panel title="Date intelligence">
                <div className="grid gap-4 text-sm">
                  {[
                    { label: "By weekday", rows: intel.byWeekday },
                    { label: "By session", rows: intel.bySession },
                    { label: "By date root", rows: intel.byDateRoot.slice(0, 5) },
                  ].map((block) => (
                    <div key={block.label}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {block.label}
                      </h3>
                      <ul className="grid gap-1">
                        {block.rows.map((r) => (
                          <li key={r.label} className="flex items-center justify-between gap-3">
                            <span>{r.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {num(r.avgMatches)} avg · best: {r.best[0]?.strategy ?? "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
