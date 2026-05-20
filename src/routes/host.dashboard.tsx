import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav } from "@/components/SiteNav";
import { toast } from "sonner";
import { Calendar, Plus, Copy, Eye, EyeOff, Pencil } from "lucide-react";

export const Route = createFileRoute("/host/dashboard")({
  component: HostDashboardPage,
});

interface HostRow {
  id: string;
  name: string;
  logo_url: string | null;
  bio: string | null;
  contact_email: string;
}

interface EventRow {
  id: string;
  title: string;
  starts_at: string;
  status: string;
  visibility: string;
  cover_image_url: string | null;
}

function HostDashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [host, setHost] = useState<HostRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const { data: h } = await supabase
      .from("hosts")
      .select("id,name,logo_url,bio,contact_email")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!h) {
      navigate({ to: "/host/onboarding" });
      return;
    }
    setHost(h as HostRow);
    const { data: evs } = await supabase
      .from("events")
      .select("id,title,starts_at,status,visibility,cover_image_url")
      .eq("created_by", user.id)
      .order("starts_at", { ascending: false });
    setEvents((evs ?? []) as EventRow[]);
    setBusy(false);
  }, [user, navigate]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/host/dashboard" } });
      return;
    }
    load();
  }, [user, loading, navigate, load]);

  async function setStatus(id: string, status: "draft" | "published") {
    const { error } = await supabase.from("events").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "published" ? "Event published." : "Event unpublished.");
    setEvents((evs) => evs.map((e) => (e.id === id ? { ...e, status } : e)));
  }

  async function duplicate(id: string) {
    if (!user) return;
    const { data: src, error } = await supabase.from("events").select("*").eq("id", id).single();
    if (error || !src) return toast.error(error?.message ?? "Not found");
    const { id: _id, created_at: _ca, ...rest } = src as Record<string, unknown>;
    void _id; void _ca;
    const copy = {
      ...rest,
      title: `${src.title} (Copy)`,
      status: "draft",
      created_by: user.id,
    } as never;
    const { data: ins, error: e2 } = await supabase.from("events").insert(copy).select("id,title,starts_at,status,visibility,cover_image_url").single();
    if (e2) return toast.error(e2.message);
    toast.success("Duplicated as draft.");
    setEvents((evs) => [ins as EventRow, ...evs]);
  }

  if (loading || busy || !host) {
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
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between mb-10">
          <div className="flex items-center gap-4">
            {host.logo_url ? (
              <img src={host.logo_url} alt={host.name} className="size-14 rounded-xl object-cover ring-1 ring-black/5" />
            ) : (
              <div className="size-14 rounded-xl bg-muted grid place-items-center text-lg font-semibold text-muted-foreground">
                {host.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-semibold leading-tight">{host.name}</h1>
              <p className="text-sm text-muted-foreground">{host.contact_email}</p>
            </div>
          </div>
          <Link
            to="/host/events/new"
            className="inline-flex items-center gap-2 bg-brand text-brand-foreground font-medium px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" />
            Create event
          </Link>
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Your events
        </h2>

        {events.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border rounded-2xl">
            <Calendar className="size-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">You haven't created any events yet.</p>
            <Link
              to="/host/events/new"
              className="inline-flex items-center gap-2 bg-foreground text-background font-medium px-4 py-2 rounded-xl hover:opacity-90"
            >
              <Plus className="size-4" />
              Create your first event
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <div key={e.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-surface rounded-2xl ring-1 ring-black/5">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="size-14 rounded-lg bg-muted overflow-hidden shrink-0">
                    {e.cover_image_url && <img src={e.cover_image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{e.title}</p>
                      <Badge tone={e.status === "published" ? "success" : "muted"}>{e.status}</Badge>
                      <Badge tone="muted">{e.visibility}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(e.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to="/host/events/$id/edit"
                    params={{ id: e.id }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-muted"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Link>
                  <button
                    onClick={() => duplicate(e.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-muted"
                  >
                    <Copy className="size-3.5" />
                    Duplicate
                  </button>
                  {e.status === "published" ? (
                    <button
                      onClick={() => setStatus(e.id, "draft")}
                      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-muted"
                    >
                      <EyeOff className="size-3.5" />
                      Unpublish
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(e.id, "published")}
                      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90"
                    >
                      <Eye className="size-3.5" />
                      Publish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Badge({ tone, children }: { tone: "success" | "muted"; children: React.ReactNode }) {
  const cls =
    tone === "success"
      ? "bg-success/15 text-success"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${cls}`}>
      {children}
    </span>
  );
}
