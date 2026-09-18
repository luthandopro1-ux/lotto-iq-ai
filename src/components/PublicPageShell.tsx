import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BrainCircuit } from "lucide-react";

export function PublicPageShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <BrainCircuit className="size-5" />
          </span>
          <span className="font-display text-lg font-bold">
            Lotto<span className="gradient-text">IQ</span> AI
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link to="/support" className="hover:text-foreground">
            Support
          </Link>
          <Link to="/account" className="hover:text-foreground">
            Account
          </Link>
        </nav>
      </header>
      <article className="mx-auto max-w-3xl py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {eyebrow} · Lum Tech Solutions
        </p>
        <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">{title}</h1>
        <div className="mt-8 space-y-8 text-sm leading-7 text-muted-foreground">{children}</div>
      </article>
      <footer className="mx-auto max-w-3xl border-t border-border/60 py-6 text-xs text-muted-foreground">
        Lotto IQ AI is developed by Lum Tech Solutions. Lottery draws are random; analysis does not
        guarantee outcomes.
      </footer>
    </main>
  );
}

export function PublicSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
