import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav } from "@/components/SiteNav";
import { EventEditor, emptyDraft, toDbPayload } from "@/components/EventEditor";
import { toast } from "sonner";

export const Route = createFileRoute("/host/events/new")({
  component: NewEventPage,
});

function NewEventPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [hostId, setHostId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/host/events/new" } });
      return;
    }
    supabase
      .from("hosts")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) navigate({ to: "/host/onboarding" });
        else setHostId(data.id);
      });
  }, [user, loading, navigate]);

  async function handleSubmit(draft: ReturnType<typeof emptyDraft extends infer T ? () => T : never> extends never ? typeof emptyDraft : typeof emptyDraft) {
    if (!user || !hostId) return;
    setSubmitting(true);
    const payload = { ...toDbPayload(draft), host_id: hostId, created_by: user.id, status: "draft" as const };
    const { data, error } = await supabase.from("events").insert(payload).select("id").single();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Draft saved.");
    navigate({ to: "/host/events/$id/edit", params: { id: data.id } });
  }

  if (loading || !hostId) {
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
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/host/dashboard" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block">
          ← Back to dashboard
        </Link>
        <h1 className="text-3xl font-semibold mb-2">Create event</h1>
        <p className="text-muted-foreground mb-8">Saved as a draft. Publish when you're ready.</p>
        <EventEditor initial={emptyDraft} submitLabel="Save draft" onSubmit={handleSubmit} submitting={submitting} />
      </main>
    </div>
  );
}
