import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, Panel } from "@/components/AppShell";
import { SyncLog } from "@/components/SyncLog";
import { predictionHistory } from "@/lib/sync.functions";
import { SESSIONS, SESSION_LABELS, type SessionKey } from "@/lib/uk49";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Prediction Ledger — Lotto IQ" },
      {
        name: "description",
        content:
          "Permanent record of every UK49s prediction locked before a draw, with the actual result, match count and HIT / PARTIAL / MISS outcome.",
      },
      { property: "og:title", content: "UK49s prediction ledger" },
      {
        property: "og:description",
        content: "Every locked prediction, its result and how it scored — Brunch to Tea Time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

const pad = (n: number) => String(n).padStart(2, "0");

const OUTCOME: Record<string, string> = {
  HIT: "bg-emerald-500/15 text-emerald-400",
  PARTIAL: "bg-amber-500/15 text-amber-400",
  MISS: "bg-destructive/15 text-destructive",
};

function HistoryPage() {
  const historyFn = useServerFn(predictionHistory);
  const [session, setSession] = useState<SessionKey | "">("");
  const [outcome, setOutcome] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["prediction-history", session, outcome],
    queryFn: () =>
      historyFn({
        data: {
          limit: 120,
          ...(session ? { session } : {}),
          ...(outcome ? { outcome } : {}),
        },
      }),
  });

  const stats = data?.stats;

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Prediction ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every prediction is written once, locked against its draw ID, and never rewritten. After
          the result is verified the actual numbers and match statistics are appended.
        </p>
      </div>

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <select
            value={session}
            onChange={(e) => setSession(e.target.value as SessionKey | "")}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All sessions</option>
            {SESSIONS.map((s) => (
              <option key={s} value={s}>
                {SESSION_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All outcomes</option>
            <option value="HIT">HIT</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="MISS">MISS</option>
          </select>
          {stats && (
            <div className="ml-auto flex gap-5 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Graded</p>
                <p className="font-display text-xl font-bold">{stats.graded}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hits</p>
                <p className="font-display text-xl font-bold text-emerald-400">{stats.hits}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Partial</p>
                <p className="font-display text-xl font-bold text-amber-400">{stats.partial}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg matched</p>
                <p className="font-display text-xl font-bold">{stats.avgMatched}</p>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Locked predictions">
        {isLoading && <p className="text-sm text-muted-foreground">Loading ledger…</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-2">Draw ID</th>
                <th className="pb-2">Locked</th>
                <th className="pb-2">Banker</th>
                <th className="pb-2">Pairs</th>
                <th className="pb-2">Actual</th>
                <th className="pb-2 text-right">Matched</th>
                <th className="pb-2 text-right">Outcome</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {(data?.records ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border/60 align-top">
                  <td className="py-2 pr-3 text-xs">{r.drawId}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {new Date(r.locked_at).toLocaleString("en-GB")}
                  </td>
                  <td className="py-2 pr-3 font-bold">{r.banker != null ? pad(r.banker) : "—"}</td>
                  <td className="py-2 pr-3 text-xs">
                    {r.rows
                      .slice(0, 3)
                      .map((row) => `${pad(row.pair[0].n)}-${pad(row.pair[1].n)}`)
                      .join(" ")}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {r.actual ? r.actual.numbers.map(pad).join(" ") : "pending"}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {r.status === "graded" ? r.matched_count : "—"}
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        OUTCOME[r.outcome ?? ""] ?? "bg-secondary/60 text-muted-foreground"
                      }`}
                    >
                      {r.outcome ?? "PENDING"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-6">
        <SyncLog />
      </div>
    </AppShell>
  );
}
