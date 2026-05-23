import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav } from "@/components/SiteNav";
import { ScanLine, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/checker")({
  component: CheckerDashboard,
});

interface EventRow {
  id: string;
  title: string;
  starts_at: string;
}

function CheckerDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/checker" } });
      return;
    }
    (async () => {
      setBusy(true);
      const { data: ids } = await (supabase.rpc as unknown as (
        fn: string,
      ) => Promise<{ data: { checker_event_ids: string }[] | null }>)(
        "checker_event_ids",
      );
      const eventIds = (ids ?? [])
        .map((r) => (typeof r === "string" ? r : r.checker_event_ids))
        .filter(Boolean) as string[];
      if (eventIds.length === 0) {
        setEvents([]);
        setBusy(false);
        return;
      }
      const { data } = await supabase
        .from("events")
        .select("id,title,starts_at")
        .in("id", eventIds)
        .order("starts_at", { ascending: true });
      setEvents((data ?? []) as EventRow[]);
      setBusy(false);
    })();
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="size-7 text-brand" />
          <h1 className="text-2xl font-semibold">Checker</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Events you're authorized to check attendees into.
        </p>
        {busy ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-border rounded-2xl">
            <p className="text-muted-foreground">
              No events assigned. Ask a host for an invite link.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <Link
                key={e.id}
                to="/host/events/$id/check-in"
                params={{ id: e.id }}
                className="flex items-center justify-between p-4 bg-surface rounded-2xl ring-1 ring-black/5 hover:bg-muted/40 transition-colors"
              >
                <div>
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(e.starts_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <ScanLine className="size-4" />
                  Check in
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
