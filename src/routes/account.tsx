import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { BrandCopyright } from "@/components/BrandCopyright";
import { supabase } from "@/integrations/supabase/client";
import { ensurePersonalAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Lotto IQ AI — Customer Account" },
      {
        name: "description",
        content: "Create or access your personal Lotto IQ workspace by Lum Tech Solutions.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    try {
      const result =
        mode === "sign-up"
          ? await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { data: { display_name: displayName.trim() || undefined } },
            })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (result.error) throw result.error;
      if (!result.data.session) {
        toast.success("Account created. Check your email to confirm access, then sign in.");
        return;
      }

      const account = await ensurePersonalAccount({
        data: { displayName: displayName.trim() || undefined },
      });
      toast.success(`Welcome to ${account.workspace.name}.`);
      await navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account request failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark className="size-10 rounded-2xl" />
          <span className="font-display text-lg font-bold tracking-tight">
            Lotto<span className="gradient-text">IQ</span> AI
          </span>
        </Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back to homepage
        </Link>
      </header>

      <section className="mx-auto grid max-w-5xl gap-8 py-14 lg:grid-cols-[1fr_0.85fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Personal workspace foundation
          </p>
          <h1 className="mt-4 max-w-xl font-display text-4xl font-bold leading-tight sm:text-5xl">
            Keep your Lotto IQ work in one place.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            Create an account to start the personal workspace foundation. The current release
            creates one workspace for you; saved strategies and private analysis history are the
            next controlled layer.
          </p>
          <div className="mt-7 space-y-3 text-sm text-muted-foreground">
            {[
              "One personal workspace per customer account",
              "UK49 selected as the current product focus",
              "No claim that accounts or Premium are already live elsewhere",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-3xl p-6 sm:p-8">
          <div className="mb-6 flex gap-1 rounded-xl bg-secondary/60 p-1">
            {(["sign-in", "sign-up"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMode(tab)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${mode === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab === "sign-in" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "sign-up" && (
              <label className="block text-sm">
                Display name{" "}
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={80}
                  autoComplete="name"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 outline-none focus:border-primary"
                  placeholder="Your name"
                />
              </label>
            )}
            <label className="block text-sm">
              Email{" "}
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="mt-1.5 w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 outline-none focus:border-primary"
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-sm">
              Password{" "}
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                className="mt-1.5 w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 outline-none focus:border-primary"
                placeholder="At least 6 characters"
              />
            </label>
            <button
              disabled={pending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {mode === "sign-in" ? "Sign in to Lotto IQ" : "Create my workspace"}
              <ArrowRight className="size-4" />
            </button>
          </form>
          <p className="mt-5 text-center text-[11px] leading-5 text-muted-foreground">
            Authentication is provided by the configured Supabase project. Your account is separate
            from the operator admin key.
          </p>
        </div>
      </section>
      <footer className="mx-auto mt-10 max-w-md text-center text-xs text-muted-foreground">
        <BrandCopyright />
      </footer>
    </main>
  );
}
