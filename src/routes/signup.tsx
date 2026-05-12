import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/",
  }),
  component: SignupPage,
});

function SignupPage() {
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + redirect },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created!");
    navigate({ to: redirect, replace: true });
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-3xl font-semibold mb-2">Create your account</h1>
        <p className="text-muted-foreground mb-8 text-sm">
          Join Phase to RSVP and keep your tickets in one place.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface ring-1 ring-black/5 rounded-lg py-2.5 px-4 text-sm focus:ring-brand outline-none"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Password
            </span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface ring-1 ring-black/5 rounded-lg py-2.5 px-4 text-sm focus:ring-brand outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand text-brand-foreground font-medium py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="text-sm text-muted-foreground mt-6 text-center">
          Already have an account?{" "}
          <Link
            to="/login"
            search={{ redirect }}
            className="text-brand font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
