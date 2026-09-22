import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  UserRound,
  Microscope,
  ShieldCheck,
  Crown,
  ChevronDown,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { getStoredAdminKey, setStoredAdminKey } from "@/integrations/admin/client-middleware";
import { BrandMark } from "@/components/BrandMark";
import { BrandCopyright } from "@/components/BrandCopyright";
import { UK49_COLOUR_LABELS, uk49ColourForNumber } from "@/lib/uk49-colours";
import { supabase } from "@/integrations/supabase/client";
import { getAccessContext } from "@/lib/customer.functions";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/premium", label: "Premium", icon: Crown },
  { to: "/account", label: "Account", icon: UserRound },
] as const;

// Operator-only tools. These routes still exist and still work, but are
// no longer in the general client nav (see the corporate/client access
// security work) — administrators still need a path to them, so they
// show up here instead, gated on the same is_administrator() check
// /admin and /premium already use.
const operatorNav = [
  { to: "/admin", label: "Admin", icon: ShieldCheck },
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

function OperatorToolsMenu() {
  const [open, setOpen] = useState(false);
  const session = useQuery({
    queryKey: ["browser-session"],
    queryFn: async () => {
      const result = await supabase.auth.getSession();
      if (result.error) throw result.error;
      return result.data.session;
    },
    enabled: typeof window !== "undefined",
  });
  const { data: access } = useQuery({
    queryKey: ["access-context"],
    queryFn: () => getAccessContext(),
    enabled: Boolean(session.data),
  });

  if (access?.role !== "administrator") return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      >
        <ShieldCheck className="size-4" />
        Operator Tools
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 grid w-64 grid-cols-2 gap-1 rounded-xl border border-border bg-popover p-2 shadow-lg">
          {operatorNav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary"
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

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
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <BrandMark className="size-9 rounded-xl" />
            <span className="font-display text-lg font-bold tracking-tight">
              Lotto <span className="gradient-text">IQ</span>
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <nav className="-mx-1 flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              {nav.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: to === "/dashboard" }}
                  className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground data-[status=active]:bg-primary/15 data-[status=active]:text-primary"
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <OperatorToolsMenu />
            <AdminKeyControl />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>

      <footer className="mx-auto max-w-7xl space-y-1 px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        <BrandCopyright />
        <p>
          Lotto IQ analyses historical UK49 and Russian lottery results against strategies you
          define. It does not predict outcomes — lottery draws are random.
        </p>
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
  size = "md",
  className = "",
  title,
}: {
  n: number;
  variant?: "default" | "primary" | "accent";
  size?: "sm" | "md";
  className?: string;
  title?: string;
}) {
  const colour = uk49ColourForNumber(n);
  return (
    <span
      className={`ball ball-uk-${colour} ${variant === "primary" ? "ball-primary" : variant === "accent" ? "ball-accent" : ""} ${size === "sm" ? "ball-sm" : ""} ${className}`}
      title={title ?? `UK49 ${UK49_COLOUR_LABELS[colour]} ball · ${n}`}
      aria-label={`Number ${n}, ${UK49_COLOUR_LABELS[colour]} UK49 ball`}
    >
      {n}
    </span>
  );
}
