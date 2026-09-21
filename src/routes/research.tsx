import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Play, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { listResearchReportsFn, triggerResearchNow } from "@/lib/research.functions";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "Research — Lotto IQ" },
      {
        name: "description",
        content:
          "Weekly Lotto IQ research comparing public lottery analysis techniques against this app's own real backtest performance.",
      },
    ],
  }),
  component: ResearchPage,
});

interface ResearchReport {
  id: string;
  status: "pending" | "completed" | "failed";
  manus_task_url: string | null;
  findings: {
    summary?: string;
    external_findings?: string[];
    comparison?: string[];
    sources?: string[];
  } | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

function ResearchPage() {
  const listFn = useServerFn(listResearchReportsFn);
  const triggerFn = useServerFn(triggerResearchNow);
  const queryClient = useQueryClient();

  const { data: reports = [] } = useQuery({
    queryKey: ["research", "reports"],
    queryFn: () => listFn() as Promise<ResearchReport[]>,
    refetchInterval: 15_000,
  });

  const trigger = useMutation({
    mutationFn: () => triggerFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "reports"] });
      toast.success("Research task started — Lotto IQ research is running in the background.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = reports[0];

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">Research</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        A weekly Lotto IQ research job reviews current public lottery-analysis techniques and
        compares them against this app's own real, walk-forward backtest numbers. It runs
        automatically every Monday; you can also trigger one manually below.
      </p>

      <Panel className="mb-6">
        <Button onClick={() => trigger.mutate()} disabled={trigger.isPending}>
          <Play className="mr-2 size-4" />
          {trigger.isPending ? "Starting…" : "Run research now"}
        </Button>
      </Panel>

      {reports.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">
            No research reports yet — run one above, or wait for Monday's scheduled job.
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          {reports.map((r) => (
            <Panel
              key={r.id}
              title={new Date(r.created_at).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            >
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    r.status === "completed"
                      ? "bg-primary/15 text-primary"
                      : r.status === "failed"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {r.status}
                </span>
                {r.manus_task_url && (
                  <a
                    href={r.manus_task_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    Open research task <ExternalLink className="size-3" />
                  </a>
                )}
              </div>

              {r.status === "failed" && <p className="text-sm text-destructive">{r.error}</p>}

              {r.status === "pending" && (
                <p className="text-sm text-muted-foreground">
                  Lotto IQ research is still running — this page refreshes automatically.
                </p>
              )}

              {r.status === "completed" && r.findings && (
                <div className="space-y-4 text-sm">
                  {r.findings.summary && <p>{r.findings.summary}</p>}
                  {r.findings.external_findings && r.findings.external_findings.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        External findings
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {r.findings.external_findings.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.findings.comparison && r.findings.comparison.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Comparison to our models
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {r.findings.comparison.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.findings.sources && r.findings.sources.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Sources
                      </p>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {r.findings.sources.map((s, i) => (
                          <li key={i} className="truncate">
                            <a
                              href={s}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-primary"
                            >
                              {s}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
    </AppShell>
  );
}
