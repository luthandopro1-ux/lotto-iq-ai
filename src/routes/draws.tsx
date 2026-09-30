import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Ball, Panel } from "@/components/AppShell";
import { SyncPanel } from "@/components/SyncPanel";
import { saveDraws, deleteDraw } from "@/lib/draws.functions";
import { SESSION_LABELS, SESSIONS, drawNumbers, type Draw, type SessionKey } from "@/lib/uk49";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/draws")({
  head: () => ({
    meta: [
      { title: "Historical Draws — Lotto IQ" },
      {
        name: "description",
        content:
          "Add UK49 draws manually, review automatic syncs, and manage your historical database.",
      },
      { property: "og:title", content: "Historical UK49 Draw Database" },
      {
        property: "og:description",
        content: "Historical UK49 Brunch, Lunch, Drive Time and Tea Time results.",
      },
    ],
  }),
  component: DrawsPage,
});

const empty = { draw_date: "", session: "lunch" as SessionKey, nums: "", booster: "" };

function DrawsPage() {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveDraws);
  const deleteFn = useServerFn(deleteDraw);
  const [manual, setManual] = useState(empty);

  const { data: draws = [] } = useQuery({
    queryKey: ["draws", "all"],
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

  const addManual = useMutation({
    mutationFn: async () => {
      const nums = manual.nums
        .split(/[^0-9]+/)
        .filter(Boolean)
        .map(Number);
      if (nums.length !== 6 || nums.some((n) => n < 1 || n > 49))
        throw new Error("Enter exactly six numbers between 1 and 49.");
      if (!manual.draw_date) throw new Error("Pick a draw date.");
      await saveFn({
        data: {
          draws: [
            {
              draw_date: manual.draw_date,
              session: manual.session,
              numbers: nums,
              booster: manual.booster ? Number(manual.booster) : null,
              source: "manual",
            },
          ],
        },
      });
    },
    onSuccess: () => {
      toast.success("Draw added.");
      setManual(empty);
      qc.invalidateQueries({ queryKey: ["draws"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteFn({ data: { id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["draws"] }),
  });

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">Historical database</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Draws sync automatically. Add a missing draw manually or remove a wrong one.
      </p>

      <SyncPanel />

      <div className="mb-6 max-w-xl">
        <Panel title="Add a draw manually">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Draw date</Label>
              <Input
                type="date"
                value={manual.draw_date}
                onChange={(e) => setManual({ ...manual, draw_date: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Session</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {SESSIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setManual({ ...manual, session: s })}
                    className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                      manual.session === s
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary/60"
                    }`}
                  >
                    {SESSION_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Six numbers</Label>
              <Input
                placeholder="4 12 19 27 33 41"
                value={manual.nums}
                onChange={(e) => setManual({ ...manual, nums: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Booster</Label>
              <Input
                placeholder="8"
                value={manual.booster}
                onChange={(e) => setManual({ ...manual, booster: e.target.value })}
              />
            </div>
            <Button className="w-full" variant="secondary" onClick={() => addManual.mutate()}>
              Add draw
            </Button>
          </div>
        </Panel>
      </div>

      <Panel title={`Stored draws (${draws.length})`} className="mt-6">
        <div className="max-h-[28rem] space-y-2 overflow-y-auto">
          {draws.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 p-2 text-xs"
            >
              <span className="w-24 font-mono">{d.draw_date}</span>
              <span className="w-20 text-primary">{SESSION_LABELS[d.session]}</span>
              {drawNumbers(d).map((n, j) => (
                <span key={j} className="ball size-7 text-[11px]">
                  {n}
                </span>
              ))}
              {d.booster != null && (
                <Ball n={d.booster} variant="accent" className="size-7 text-[11px]" />
              )}
              <button
                onClick={() => remove.mutate(d.id)}
                className="ml-auto text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Delete draw"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {draws.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing imported yet.</p>
          )}
        </div>
      </Panel>
    </AppShell>
  );
}
