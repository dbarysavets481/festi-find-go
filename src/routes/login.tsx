import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/",
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: redirect, replace: true });
  }, [user, redirect, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: redirect, replace: true });
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-3xl font-semibold mb-2">Sign in</h1>
        <p className="text-muted-foreground mb-8 text-sm">Welcome back to Phase.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface ring-1 ring-black/5 rounded-lg py-2.5 px-4 text-sm focus:ring-brand outline-none"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface ring-1 ring-black/5 rounded-lg py-2.5 px-4 text-sm focus:ring-brand outline-none"
            />
          </Field>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand text-brand-foreground font-medium py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-sm text-muted-foreground mt-6 text-center">
          New to Phase?{" "}
          <Link
            to="/signup"
            search={{ redirect }}
            className="text-brand font-medium hover:underline"
          >
            Create an account
          </Link>
        </p>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}
