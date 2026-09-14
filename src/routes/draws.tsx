import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Panel } from "@/components/AppShell";
import { SyncPanel } from "@/components/SyncPanel";
import { smartImportDraws, type ParsedDraw } from "@/lib/ai.functions";
import { saveDraws, deleteDraw } from "@/lib/draws.functions";
import { SESSION_LABELS, SESSIONS, drawNumbers, type Draw, type SessionKey } from "@/lib/uk49";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Trash2, Upload, Wand2 } from "lucide-react";

export const Route = createFileRoute("/draws")({
  head: () => ({
    meta: [
      { title: "Historical Draws — Lotto IQ AI" },
      {
        name: "description",
        content:
          "Import UK49 results in any format with the AI importer, or add draws manually, and manage your historical database.",
      },
      { property: "og:title", content: "Historical UK49 Draw Database" },
      {
        property: "og:description",
        content: "AI-assisted import of UK49 Brunch, Lunch, Drive Time and Tea Time results.",
      },
    ],
  }),
  component: DrawsPage,
});

const empty = { draw_date: "", session: "lunch" as SessionKey, nums: "", booster: "" };

function DrawsPage() {
  const qc = useQueryClient();
  const importFn = useServerFn(smartImportDraws);
  const saveFn = useServerFn(saveDraws);
  const deleteFn = useServerFn(deleteDraw);
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<ParsedDraw[]>([]);
  const [notes, setNotes] = useState("");
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

  const parse = useMutation({
    mutationFn: async () => importFn({ data: { raw } }),
    onSuccess: (res) => {
      setPreview(res.draws);
      setNotes(res.notes);
      if (res.draws.length === 0)
        toast.error("The AI could not find any valid draws in that text.");
      else
        toast.success(`${res.draws.length} draw${res.draws.length === 1 ? "" : "s"} recognised.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async (rows: ParsedDraw[]) => {
      await saveFn({
        data: {
          draws: rows.map((d) => ({
            draw_date: d.draw_date,
            session: d.session,
            numbers: d.numbers,
            booster: d.booster ?? null,
            source: "ai-import",
          })),
        },
      });
    },
    onSuccess: () => {
      toast.success("Draws saved to your historical database.");
      setPreview([]);
      setRaw("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["draws"] });
    },
    onError: (e: Error) => toast.error(e.message),
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

  const onFile = async (file: File) => {
    const text = await file.text();
    setRaw(text.slice(0, 200000));
    toast.success(`Loaded ${file.name}. Press "Read with AI".`);
  };

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">Historical database</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        The AI importer reads any format — CSV, pasted tables, messages, PDF text — and files every
        draw into Brunch, Lunch, Drive Time and Tea Time.
      </p>

      <SyncPanel />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="AI smart import" className="lg:col-span-2">
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={9}
            placeholder={`Paste anything, e.g.\n06/08/2026 Lunchtime  4 12 19 27 33 41  B: 8\n6 Aug 26 teatime — 3,9,14,22,38,44 (booster 17)`}
            className="resize-y font-mono text-xs"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => parse.mutate()}
              disabled={raw.trim().length < 3 || parse.isPending}
            >
              <Wand2 className="mr-2 size-4" />
              {parse.isPending ? "Reading…" : "Read with AI"}
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary/60">
              <Upload className="size-4" />
              Upload file
              <input
                type="file"
                accept=".csv,.txt,.tsv,text/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
            </label>
            {notes && <span className="text-xs text-muted-foreground">{notes}</span>}
          </div>

          {preview.length > 0 && (
            <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  <Sparkles className="mr-1.5 inline size-4 text-primary" />
                  {preview.length} draw{preview.length === 1 ? "" : "s"} ready to import
                </p>
                <Button size="sm" onClick={() => save.mutate(preview)} disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save all"}
                </Button>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {preview.map((d, i) => (
                  <div
                    key={`${d.draw_date}-${d.session}-${i}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 p-2 text-xs"
                  >
                    <span className="w-24 font-mono">{d.draw_date}</span>
                    <span className="w-20 text-primary">{SESSION_LABELS[d.session]}</span>
                    {d.numbers.map((n, j) => (
                      <span key={j} className="ball size-7 text-[11px]">
                        {n}
                      </span>
                    ))}
                    {d.booster != null && (
                      <span className="ball ball-accent size-7 text-[11px]">{d.booster}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

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
                <span className="ball ball-accent size-7 text-[11px]">{d.booster}</span>
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
