import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Panel } from "@/components/AppShell";
import { syncStatus } from "@/lib/sync.functions";

/** Admin sync log: recent ingest runs, per-session freshness and any gaps. */
export function SyncLog() {
  const statusFn = useServerFn(syncStatus);
  const { data } = useQuery({
    queryKey: ["sync-status"],
    queryFn: () => statusFn(),
    refetchInterval: 30_000,
  });

  return (
    <Panel
      title="Synchronisation log"
      action={
        <span className="text-xs text-muted-foreground">
          UK now {data?.ukNow ?? "…"} · next {data?.nextTarget ?? "…"}
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(data?.perSession ?? []).map((s) => (
          <div key={s.session} className="rounded-xl border border-border/70 p-3">
            <p className="text-xs font-semibold text-primary">
              {s.label} · {s.ukTime}
            </p>
            <p className="mt-1 font-mono text-xs">{s.latest ?? "no draw stored"}</p>
            <p className="text-[11px] text-muted-foreground">
              {s.importedAt
                ? `imported ${new Date(s.importedAt).toLocaleString("en-GB")}`
                : "never imported"}
            </p>
          </div>
        ))}
      </div>

      {data && data.missing.length > 0 && (
        <p className="mt-3 font-mono text-xs text-amber-400">
          gaps: {data.missing.map((m) => `${m.drawId}${m.overdue ? " (overdue)" : ""}`).join(" · ")}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs">
          <thead>
            <tr className="text-left uppercase tracking-widest text-muted-foreground">
              <th className="pb-2">Started</th>
              <th className="pb-2">Mode</th>
              <th className="pb-2">Status</th>
              <th className="pb-2 text-right">Found</th>
              <th className="pb-2 text-right">Added</th>
              <th className="pb-2 text-right">Skipped</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {(data?.runs ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="py-1.5">{new Date(r.startedAt).toLocaleString("en-GB")}</td>
                <td className="py-1.5">{r.mode}</td>
                <td className={`py-1.5 ${r.status === "ok" ? "text-emerald-400" : "text-destructive"}`}>
                  {r.status}
                  {r.error ? ` — ${r.error.slice(0, 60)}` : ""}
                </td>
                <td className="py-1.5 text-right">{r.found}</td>
                <td className="py-1.5 text-right">{r.inserted}</td>
                <td className="py-1.5 text-right">{r.skipped}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
