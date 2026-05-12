import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/hooks/use-auth";
import { eventImage } from "@/lib/event-images";
import { buildIcs, downloadIcs } from "@/lib/calendar";
import { Calendar, MapPin, Ticket as TicketIcon } from "lucide-react";

export const Route = createFileRoute("/my-tickets")({
  head: () => ({ meta: [{ title: "My Tickets — Phase" }] }),
  component: MyTicketsPage,
});

interface TicketRow {
  id: string;
  ticket_code: string;
  created_at: string;
  event: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    venue: string | null;
    online_url: string | null;
    location: string | null;
    cover_image_url: string | null;
    description: string;
    timezone: string;
  } | null;
}

function MyTicketsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login", search: { redirect: "/my-tickets" }, replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("rsvps")
      .select(
        "id,ticket_code,created_at,event:events(id,title,starts_at,ends_at,venue,online_url,location,cover_image_url,description,timezone)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTickets((data ?? []) as unknown as TicketRow[]);
        setLoading(false);
      });
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen">
        <SiteNav />
      </div>
    );
  }

  const now = Date.now();
  const upcoming = tickets.filter((t) => t.event && new Date(t.event.starts_at).getTime() >= now);
  const past = tickets.filter((t) => t.event && new Date(t.event.starts_at).getTime() < now);

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-semibold mb-2">My Tickets</h1>
        <p className="text-muted-foreground mb-10 text-sm">
          Your reserved spots, all in one place.
        </p>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center">
            <TicketIcon className="size-10 mx-auto text-muted-foreground mb-4" />
            <p className="mb-6 text-muted-foreground">You haven't RSVP'd to anything yet.</p>
            <Link
              to="/"
              className="inline-flex bg-foreground text-background font-medium px-5 py-2.5 rounded-xl hover:opacity-90"
            >
              Explore events
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            <Section title="Upcoming" tickets={upcoming} />
            {past.length > 0 && <Section title="Past" tickets={past} faded />}
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ title, tickets, faded }: { title: string; tickets: TicketRow[]; faded?: boolean }) {
  if (tickets.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        {title}
      </h2>
      <div className="space-y-4">
        {tickets.map((t) => (
          <TicketCard key={t.id} ticket={t} faded={faded} />
        ))}
      </div>
    </div>
  );
}

function TicketCard({ ticket, faded }: { ticket: TicketRow; faded?: boolean }) {
  if (!ticket.event) return null;
  const ev = ticket.event;
  const start = new Date(ev.starts_at);
  const end = ev.ends_at ? new Date(ev.ends_at) : new Date(start.getTime() + 2 * 3600 * 1000);

  function add() {
    const ics = buildIcs({
      title: ev!.title,
      description: ev!.description,
      location: ev!.venue ?? ev!.online_url ?? ev!.location ?? "",
      start,
      end,
      uid: `${ev!.id}@phase`,
    });
    downloadIcs(`${ev!.title.replace(/\s+/g, "-").toLowerCase()}.ics`, ics);
  }

  return (
    <div className={`bg-surface rounded-2xl ring-1 ring-black/5 overflow-hidden flex flex-col sm:flex-row ${faded ? "opacity-60" : ""}`}>
      <Link
        to="/events/$id"
        params={{ id: ev.id }}
        className="sm:w-48 aspect-[16/9] sm:aspect-auto bg-muted shrink-0"
      >
        <img
          src={eventImage(ev.cover_image_url)}
          alt={ev.title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </Link>
      <div className="flex-1 p-5 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand mb-1">
            {start.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <Link to="/events/$id" params={{ id: ev.id }}>
            <h3 className="text-lg font-semibold mb-1 truncate hover:text-brand">{ev.title}</h3>
          </Link>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="size-3.5" />
            {ev.venue ?? ev.online_url ?? ev.location ?? "TBA"}
          </p>
        </div>
        <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 sm:border-l sm:border-dashed sm:border-border sm:pl-5">
          <div className="text-center sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Ticket
            </p>
            <p className="font-mono text-sm font-semibold">{ticket.ticket_code}</p>
          </div>
          {!faded && (
            <button
              onClick={add}
              className="text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-black/5 bg-muted/40 hover:bg-muted flex items-center gap-1.5"
            >
              <Calendar className="size-3.5" />
              Add to Calendar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
