import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav } from "@/components/SiteNav";
import { toast } from "sonner";
import { ArrowLeft, Check, X, EyeOff, Eye, Flag } from "lucide-react";

export const Route = createFileRoute("/host/events/$id/moderation")({
  component: ModerationPage,
});

interface PhotoRow {
  id: string;
  image_url: string;
  status: string;
  hidden: boolean;
  user_id: string;
  created_at: string;
}

interface ReportRow {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
}

interface EventRow {
  id: string;
  title: string;
  created_by: string | null;
  hidden: boolean;
}

function ModerationPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: ev } = await supabase
      .from("events")
      .select("id,title,created_by,hidden")
      .eq("id", id)
      .maybeSingle();
    if (!ev || ev.created_by !== user.id) {
      setAuthorized(false);
      return;
    }
    setAuthorized(true);
    setEvent(ev as EventRow);

    const { data: ph } = await supabase
      .from("event_photos" as never)
      .select("id,image_url,status,hidden,user_id,created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false });
    setPhotos((ph ?? []) as PhotoRow[]);

    const photoIds = ((ph ?? []) as PhotoRow[]).map((p) => p.id);
    const targetIds = [id, ...photoIds];
    const { data: rp } = await supabase
      .from("reports" as never)
      .select("id,target_type,target_id,reason,status,created_at")
      .in("target_id", targetIds)
      .order("created_at", { ascending: false });
    setReports((rp ?? []) as ReportRow[]);
  }, [id, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: `/host/events/${id}/moderation` } });
      return;
    }
    load();
  }, [loading, user, id, navigate, load]);

  async function setPhotoStatus(photoId: string, status: "approved" | "rejected") {
    const { error } = await supabase
      .from("event_photos" as never)
      .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() } as never)
      .eq("id", photoId);
    if (error) return toast.error(error.message);
    setPhotos((p) => p.map((x) => (x.id === photoId ? { ...x, status } : x)));
    toast.success(status === "approved" ? "Photo approved." : "Photo rejected.");
  }

  async function setPhotoHidden(photoId: string, hidden: boolean) {
    const { error } = await supabase
      .from("event_photos" as never)
      .update({ hidden } as never)
      .eq("id", photoId);
    if (error) return toast.error(error.message);
    setPhotos((p) => p.map((x) => (x.id === photoId ? { ...x, hidden } : x)));
    toast.success(hidden ? "Photo hidden." : "Photo restored.");
  }

  async function setEventHidden(hidden: boolean) {
    const { error } = await supabase.from("events").update({ hidden }).eq("id", id);
    if (error) return toast.error(error.message);
    setEvent((e) => (e ? { ...e, hidden } : e));
    toast.success(hidden ? "Event hidden from public." : "Event restored.");
  }

  async function resolveReport(reportId: string, status: "actioned" | "dismissed") {
    const { error } = await supabase
      .from("reports" as never)
      .update({ status } as never)
      .eq("id", reportId);
    if (error) return toast.error(error.message);
    setReports((r) => r.map((x) => (x.id === reportId ? { ...x, status } : x)));
  }

  if (loading || authorized === null) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <div className="max-w-3xl mx-auto px-6 py-24 text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!authorized) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <div className="max-w-3xl mx-auto px-6 py-24">
          <p>You don't have access to moderate this event.</p>
        </div>
      </div>
    );
  }

  const pending = photos.filter((p) => p.status === "pending");
  const openReports = reports.filter((r) => r.status === "open");

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link
          to="/host/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        <div className="flex items-start justify-between gap-3 mb-8 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold mb-1">Moderation</h1>
            <p className="text-sm text-muted-foreground">{event?.title}</p>
          </div>
          <button
            onClick={() => setEventHidden(!event?.hidden)}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg ring-1 ring-black/10 hover:bg-muted"
          >
            {event?.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            {event?.hidden ? "Restore event" : "Hide event"}
          </button>
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Pending photos ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-10">Nothing waiting.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
            {pending.map((p) => (
              <div key={p.id} className="bg-surface rounded-xl ring-1 ring-black/5 overflow-hidden">
                <div className="aspect-square bg-muted">
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-2 p-2">
                  <button
                    onClick={() => setPhotoStatus(p.id, "approved")}
                    className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded bg-success/15 text-success hover:bg-success/25"
                  >
                    <Check className="size-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => setPhotoStatus(p.id, "rejected")}
                    className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded bg-muted hover:bg-muted/70"
                  >
                    <X className="size-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Approved photos
        </h2>
        {photos.filter((p) => p.status === "approved").length === 0 ? (
          <p className="text-sm text-muted-foreground mb-10">None.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {photos
              .filter((p) => p.status === "approved")
              .map((p) => (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted ring-1 ring-black/5">
                  <img src={p.image_url} alt="" className={`w-full h-full object-cover ${p.hidden ? "opacity-40" : ""}`} />
                  <button
                    onClick={() => setPhotoHidden(p.id, !p.hidden)}
                    className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[10px] font-medium bg-background/90 px-2 py-1 rounded ring-1 ring-black/10"
                  >
                    {p.hidden ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                    {p.hidden ? "Restore" : "Hide"}
                  </button>
                </div>
              ))}
          </div>
        )}

        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Flag className="size-3.5" />
          Reports ({openReports.length} open)
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id} className="bg-surface rounded-xl ring-1 ring-black/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      {r.target_type} · {r.status}
                    </p>
                    <p className="text-sm text-pretty">{r.reason}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  {r.status === "open" && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => resolveReport(r.id, "actioned")}
                        className="text-xs font-medium px-2 py-1 rounded bg-foreground text-background hover:opacity-90"
                      >
                        Mark actioned
                      </button>
                      <button
                        onClick={() => resolveReport(r.id, "dismissed")}
                        className="text-xs font-medium px-2 py-1 rounded hover:bg-muted"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
