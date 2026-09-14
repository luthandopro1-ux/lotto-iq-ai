import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Panel } from "@/components/AppShell";
import { allRules } from "@/lib/engine";
import { createStrategy, updateStrategy, deleteStrategy } from "@/lib/strategies.functions";

import type { Strategy } from "@/lib/uk49";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/strategies")({
  head: () => ({
    meta: [
      { title: "Strategy Library — Lotto IQ AI" },
      {
        name: "description",
        content:
          "Create unlimited UK49 strategies with formulas, variables, weights and notes, and enable or disable them at will.",
      },
      { property: "og:title", content: "UK49 Strategy Library" },
      {
        property: "og:description",
        content: "A modular rule engine where every strategy runs independently.",
      },
    ],
  }),
  component: StrategiesPage,
});

const rules = allRules();
const blank = {
  name: "",
  description: "",
  rule_type: rules[0]?.type ?? "date_x_number",
  weight: "1",
  notes: "",
};

function StrategiesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(blank);

  const { data: strategies = [] } = useQuery({
    queryKey: ["strategies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("strategies").select("*").order("created_at");
      if (error) throw error;
      return data as Strategy[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Give the strategy a name.");
      await createStrategy({
        data: {
          name: form.name.trim().slice(0, 120),
          description: form.description.trim().slice(0, 600) || null,
          rule_type: form.rule_type,
          weight: Number(form.weight) || 1,
          notes: form.notes.trim().slice(0, 600) || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Strategy added.");
      setForm(blank);
      qc.invalidateQueries({ queryKey: ["strategies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { enabled?: boolean; weight?: number };
    }) => {
      await updateStrategy({ data: { id, patch } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteStrategy({ data: { id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">Strategy library</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Each strategy runs independently through the rule engine. New rule types can be registered
        without touching existing strategies.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="New strategy">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                maxLength={120}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My date multiplier"
              />
            </div>
            <div>
              <Label className="text-xs">Formula / rule type</Label>
              <select
                value={form.rule_type}
                onChange={(e) => setForm({ ...form, rule_type: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm"
              >
                {rules.map((r) => (
                  <option key={r.type} value={r.type}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {rules.find((r) => r.type === form.rule_type)?.explain}
              </p>
            </div>
            <div>
              <Label className="text-xs">Weight</Label>
              <Input
                type="number"
                step="0.1"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={2}
                maxLength={600}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                rows={2}
                maxLength={600}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>
              Add strategy
            </Button>
          </div>
        </Panel>

        <div className="space-y-4 lg:col-span-2">
          {strategies.map((s) => (
            <div key={s.id} className="glass glass-hover rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold">{s.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.description || rules.find((r) => r.type === s.rule_type)?.explain}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-secondary/70 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                    ×{Number(s.weight).toFixed(1)}
                  </span>
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={(v) => update.mutate({ id: s.id, patch: { enabled: v } })}
                  />
                  <button
                    onClick={() => remove.mutate(s.id)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Delete strategy"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-primary">
                  {s.rule_type}
                </span>
                <span className={s.enabled ? "text-success" : "text-muted-foreground"}>
                  {s.enabled ? "Active" : "Disabled"}
                </span>
              </div>
              {s.notes && (
                <p className="mt-3 border-l-2 border-border pl-3 text-xs text-muted-foreground">
                  {s.notes}
                </p>
              )}
            </div>
          ))}
          {strategies.length === 0 && (
            <Panel>
              <p className="text-sm text-muted-foreground">No strategies yet.</p>
            </Panel>
          )}
        </div>
      </div>
    </AppShell>
  );
}
