import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav } from "@/components/SiteNav";
import { EventEditor, fromDbRow, toDbPayload, type EventDraft } from "@/components/EventEditor";
import { toast } from "sonner";
import { Eye, EyeOff, Copy } from "lucide-react";
import { ExportCsvButton } from "@/components/ExportCsvButton";

export const Route = createFileRoute("/host/events/$id/edit")({
  component: EditEventPage,
});

function EditEventPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<EventDraft | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: `/host/events/${id}/edit` } });
      return;
    }
    supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Event not found");
          navigate({ to: "/host/dashboard" });
          return;
        }
        setInitial(fromDbRow(data));
        setStatus((data.status as "draft" | "published") ?? "draft");
      });
  }, [id, user, loading, navigate]);

  async function handleSubmit(d: EventDraft) {
    setSubmitting(true);
    const { error } = await supabase.from("events").update(toDbPayload(d)).eq("id", id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Saved.");
  }

  async function toggleStatus() {
    const next = status === "published" ? "draft" : "published";
    const { error } = await supabase.from("events").update({ status: next }).eq("id", id);
    if (error) return toast.error(error.message);
    setStatus(next);
    toast.success(next === "published" ? "Event published." : "Event unpublished.");
  }

  async function duplicate() {
    if (!user) return;
    const { data: src } = await supabase.from("events").select("*").eq("id", id).single();
    if (!src) return;
    const { id: _id, created_at: _ca, ...rest } = src as Record<string, unknown>;
    void _id; void _ca;
    const { data, error } = await supabase
      .from("events")
      .insert({ ...rest, title: `${src.title} (Copy)`, status: "draft", created_by: user.id } as never)
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    toast.success("Duplicated as draft.");
    navigate({ to: "/host/events/$id/edit", params: { id: data.id } });
  }

  if (loading || !initial) {
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-semibold">Edit event</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Status: <span className={`font-semibold ${status === "published" ? "text-success" : "text-foreground"}`}>{status}</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <ExportCsvButton eventId={id} variant="ring" />
            <button
              onClick={duplicate}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg hover:bg-muted ring-1 ring-black/5"
            >
              <Copy className="size-4" />
              Duplicate
            </button>
            <button
              onClick={toggleStatus}
              className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg ${
                status === "published"
                  ? "hover:bg-muted ring-1 ring-black/5"
                  : "bg-foreground text-background hover:opacity-90"
              }`}
            >
              {status === "published" ? <><EyeOff className="size-4" /> Unpublish</> : <><Eye className="size-4" /> Publish</>}
            </button>
          </div>
        </div>
        <EventEditor initial={initial} submitLabel="Save changes" onSubmit={handleSubmit} submitting={submitting} />
      </main>
    </div>
  );
}
