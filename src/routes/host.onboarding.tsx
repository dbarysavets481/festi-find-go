import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav } from "@/components/SiteNav";
import { toast } from "sonner";

export const Route = createFileRoute("/host/onboarding")({
  component: HostOnboardingPage,
});

function HostOnboardingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bio, setBio] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/host/onboarding" } });
      return;
    }
    setContactEmail(user.email ?? "");
    supabase
      .from("hosts")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) navigate({ to: "/host/dashboard" });
        else setChecking(false);
      });
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!name.trim() || !contactEmail.trim()) {
      toast.error("Name and contact email are required.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("hosts").insert({
      user_id: user.id,
      name: name.trim(),
      logo_url: logoUrl.trim() || null,
      bio: bio.trim() || null,
      contact_email: contactEmail.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Host profile created!");
    navigate({ to: "/host/dashboard" });
  }

  if (loading || checking) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <div className="max-w-7xl mx-auto px-6 py-24 text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block">
          ← Back
        </Link>
        <h1 className="text-3xl font-semibold mb-2">Become a host</h1>
        <p className="text-muted-foreground mb-8">
          Create a host profile so attendees know who's behind your events.
        </p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Host name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              className="input"
              placeholder="Your studio, collective or brand"
            />
          </Field>
          <Field label="Logo URL">
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="input"
              placeholder="https://…"
            />
          </Field>
          <Field label="Short bio">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={4}
              className="input resize-none"
              placeholder="Tell people what you do."
            />
          </Field>
          <Field label="Contact email" required>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
              maxLength={255}
              className="input"
            />
          </Field>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand text-brand-foreground font-medium py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create host profile"}
          </button>
        </form>
        <style>{`.input{width:100%;background:var(--color-surface);border:1px solid var(--color-border);border-radius:.75rem;padding:.625rem .875rem;font-size:.875rem;outline:none;transition:all .15s}.input:focus{border-color:var(--color-brand);box-shadow:0 0 0 3px color-mix(in oklab, var(--color-brand) 15%, transparent)}`}</style>
      </main>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}{required && <span className="text-brand"> *</span>}
      </span>
      {children}
    </label>
  );
}
