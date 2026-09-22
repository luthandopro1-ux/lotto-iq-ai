import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  backfillYear,
  drawCoverage,
  recentIngestRuns,
  syncLatestDraws,
} from "@/lib/ingest.functions";
import { runDailyBoard } from "@/lib/predict.functions";
import { SESSION_LABELS, type SessionKey } from "@/lib/uk49";
import { RefreshCw, History, Send } from "lucide-react";

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getUTCFullYear() - 1 - i);

/** Live UK49s sync: pull the newest results and backfill past years. */
export function SyncPanel() {
  const qc = useQueryClient();
  const sync = useServerFn(syncLatestDraws);
  const backfill = useServerFn(backfillYear);
  const publishBoard = useServerFn(runDailyBoard);
  const coverageFn = useServerFn(drawCoverage);
  const runsFn = useServerFn(recentIngestRuns);
  const [year, setYear] = useState(YEARS[0]!);

  const coverage = useQuery({ queryKey: ["coverage"], queryFn: () => coverageFn({}) });
  const runs = useQuery({ queryKey: ["ingest-runs"], queryFn: () => runsFn({}) });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["draws"] });
    void coverage.refetch();
    void runs.refetch();
  };

  const runSync = useMutation({
    mutationFn: () => sync({ data: { trigger: "manual" } }),
    onSuccess: (s) => {
      toast.success(
        `Synced ${s.inserted} new draw${s.inserted === 1 ? "" : "s"} (${s.found} checked).`,
      );
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runBackfill = useMutation({
    mutationFn: () => backfill({ data: { year } }),
    onSuccess: (s) => {
      toast.success(`${year}: ${s.inserted} draws added, ${s.skipped} already stored.`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runPublish = useMutation({
    mutationFn: () => publishBoard({ data: {} }),
    onSuccess: (result) => {
      const next = result.nextTarget;
      const published = result.board.filter((slot) => slot.prediction).length;
      const warnings = result.syncErrors.length;
      toast.success(
        `Published ${published} prediction${published === 1 ? "" : "s"}; next target ${next.date} ${next.session}.${
          warnings ? ` ${warnings} warning${warnings === 1 ? "" : "s"}.` : ""
        }`,
      );
      refresh();
      void qc.invalidateQueries({ queryKey: ["admin", "predictions"] });
      void qc.invalidateQueries({ queryKey: ["customer", "premium-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lastRun = runs.data?.[0];

  return (
    <Panel title="Live UK49s sync" className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => runSync.mutate()} disabled={runSync.isPending}>
          <RefreshCw className={`mr-2 size-4 ${runSync.isPending ? "animate-spin" : ""}`} />
          {runSync.isPending ? "Syncing…" : "Sync latest draws"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => runPublish.mutate()}
          disabled={runPublish.isPending}
        >
          <Send className={`mr-2 size-4 ${runPublish.isPending ? "animate-pulse" : ""}`} />
          {runPublish.isPending ? "Publishing…" : "Publish today’s calculation"}
        </Button>

        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            onClick={() => runBackfill.mutate()}
            disabled={runBackfill.isPending}
          >
            <History className="mr-2 size-4" />
            {runBackfill.isPending ? "Loading…" : "Backfill year"}
          </Button>
        </div>

        {lastRun && (
          <span className="text-xs text-muted-foreground">
            Last run {new Date(lastRun.started_at).toLocaleString("en-GB")} — {lastRun.status},{" "}
            {lastRun.inserted} added
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(coverage.data ?? []).map((c) => (
          <div key={c.session} className="rounded-xl border border-border/70 p-3">
            <p className="text-xs font-semibold text-primary">
              {SESSION_LABELS[c.session as SessionKey]}
            </p>
            <p className="mt-1 font-display text-xl font-bold">{c.stored}</p>
            <p className="text-[11px] text-muted-foreground">
              {c.earliest ? `${c.earliest} → ${c.latest}` : "No draws stored"}
            </p>
            {c.missing.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {c.missing.length} missing date{c.missing.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
