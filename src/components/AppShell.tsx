import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Database,
  Library,
  Sparkles,
  History,
  BrainCircuit,
  Target,
  ScrollText,
  Compass,
  Globe,
  KeyRound,
  Microscope,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { getStoredAdminKey, setStoredAdminKey } from "@/integrations/admin/client-middleware";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/predictions", label: "Predictions", icon: Target },
  { to: "/history", label: "Ledger", icon: ScrollText },
  { to: "/draws", label: "Draws", icon: Database },
  { to: "/strategies", label: "Strategies", icon: Library },
  { to: "/analysis", label: "Analysis", icon: Sparkles },
  { to: "/ensemble", label: "Ensemble", icon: BrainCircuit },
  { to: "/structure", label: "Structure", icon: Compass },
  { to: "/backtest", label: "Backtest", icon: History },
  { to: "/russia", label: "Russia", icon: Globe },
  { to: "/research", label: "Research", icon: Microscope },
] as const;

function AdminKeyControl() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => getStoredAdminKey());
  const [saved, setSaved] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        title="Admin key (only needed if ADMIN_API_KEY is set on the server)"
      >
        <KeyRound className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-64 rounded-xl border border-border bg-popover p-3 text-xs shadow-lg">
          <p className="mb-2 text-muted-foreground">
            Only needed if this deployment has <code>ADMIN_API_KEY</code> set. Saved locally in this
            browser only.
          </p>
          <input
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            placeholder="Admin key"
            className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          />
          <button
            onClick={() => {
              setStoredAdminKey(value.trim());
              setSaved(true);
            }}
            className="w-full rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
              <BrainCircuit className="size-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Lotto<span className="gradient-text">IQ</span> AI
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <nav className="-mx-1 flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              {nav.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: to === "/" }}
                  className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary"
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <AdminKeyControl />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        Lotto IQ AI analyses historical UK49 and Russian lottery results against strategies you
        define. It does not predict outcomes — lottery draws are random.
      </footer>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass rounded-2xl p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Ball({
  n,
  variant = "default",
}: {
  n: number;
  variant?: "default" | "primary" | "accent";
}) {
  return (
    <span
      className={
        variant === "primary"
          ? "ball ball-primary"
          : variant === "accent"
            ? "ball ball-accent"
            : "ball"
      }
    >
      {n}
    </span>
  );
}
