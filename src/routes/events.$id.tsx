import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/hooks/use-auth";
import { eventImage } from "@/lib/event-images";
import { buildIcs, downloadIcs } from "@/lib/calendar";
import { toast } from "sonner";
import { Calendar, MapPin, Users, Clock, Globe, CheckCircle2, Ticket, Hourglass, X } from "lucide-react";
import { FeedbackSection } from "@/components/FeedbackSection";
import { GallerySection } from "@/components/GallerySection";
import { ReportButton } from "@/components/ReportButton";

export const Route = createFileRoute("/events/$id")({
  component: EventDetailPage,
});

interface EventRow {
  id: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  venue: string | null;
  online_url: string | null;
  capacity: number | null;
  location: string | null;
}

interface RsvpRow {
  id: string;
  ticket_code: string;
  created_at: string;
  status: "confirmed" | "waitlist";
}


function EventDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [rsvp, setRsvp] = useState<RsvpRow | null>(null);
  const [goingCount, setGoingCount] = useState(0);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function refreshCounts(eventId: string) {
    const [{ count: going }, { count: waiting }] = await Promise.all([
      supabase
        .from("rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "confirmed"),
      supabase
        .from("rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "waitlist"),
    ]);
    setGoingCount(going ?? 0);
    setWaitlistCount(waiting ?? 0);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: ev } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      if (!active) return;
      setEvent(ev as EventRow | null);
      await refreshCounts(id);
      if (user) {
        const { data: r } = await supabase
          .from("rsvps")
          .select("id,ticket_code,created_at,status")
          .eq("event_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (active) setRsvp(r as RsvpRow | null);
      } else {
        setRsvp(null);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, user]);


  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <div className="max-w-7xl mx-auto px-6 py-24 text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!event) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <div className="max-w-7xl mx-auto px-6 py-24">
          <p className="mb-4">Event not found.</p>
          <Link to="/" className="text-brand underline">
            Back to explore
          </Link>
        </div>
      </div>
    );
  }

  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + 2 * 3600 * 1000);
  const isPast = start.getTime() < Date.now();
  const spotsLeft = event.capacity ? Math.max(0, event.capacity - goingCount) : null;
  const soldOut = spotsLeft === 0;

  async function handleRsvp() {
    if (!user) {
      navigate({ to: "/login", search: { redirect: `/events/${id}` } });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("rsvps")
      .insert({ event_id: id, user_id: user.id })
      .select("id,ticket_code,created_at,status")
      .single();
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    const row = data as RsvpRow;
    setRsvp(row);
    await refreshCounts(id);
    setSubmitting(false);
    if (row.status === "waitlist") {
      toast.success("You're on the waitlist. We'll promote you if a spot opens.");
    } else {
      toast.success("You're going! Ticket added to My Tickets.");
    }
  }

  async function handleCancel() {
    if (!rsvp) return;
    setSubmitting(true);
    const { error } = await supabase.from("rsvps").delete().eq("id", rsvp.id);
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    setRsvp(null);
    await refreshCounts(id);
    setSubmitting(false);
    toast.success("RSVP cancelled.");
  }


  function handleAddToCalendar() {
    if (!event) return;
    const ics = buildIcs({
      title: event.title,
      description: event.description,
      location: event.venue ?? event.online_url ?? event.location ?? "",
      start,
      end,
      uid: `${event.id}@phase`,
    });
    downloadIcs(`${event.title.replace(/\s+/g, "-").toLowerCase()}.ics`, ics);
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block">
          ← Back to explore
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mt-4">
          <div className="lg:col-span-8">
            <div className="w-full aspect-[21/9] bg-muted rounded-2xl overflow-hidden mb-8 ring-1 ring-black/5 relative">
              <img
                src={eventImage(event.cover_image_url)}
                alt={event.title}
                className="w-full h-full object-cover"
                width={1280}
                height={896}
              />
              {isPast && (
                <div className="absolute inset-0 bg-black/40 grid place-items-center">
                  <span className="rounded-full bg-background px-5 py-1.5 text-sm font-bold uppercase tracking-widest">
                    Ended
                  </span>
                </div>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-semibold text-balance max-w-[35ch] mb-4">
              {event.title}
            </h1>
            <p className="text-base text-muted-foreground text-pretty max-w-[60ch] mb-8 whitespace-pre-line">
              {event.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-border pt-8">
              <Detail icon={<Calendar className="size-4" />} label="Date">
                {start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </Detail>
              <Detail icon={<Clock className="size-4" />} label="Time">
                {start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                {" – "}
                {end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                <span className="text-muted-foreground"> · {event.timezone}</span>
              </Detail>
              {event.venue && (
                <Detail icon={<MapPin className="size-4" />} label="Venue">
                  {event.venue}
                  {event.location && <span className="text-muted-foreground"> · {event.location}</span>}
                </Detail>
              )}
              {event.online_url && (
                <Detail icon={<Globe className="size-4" />} label="Online">
                  <a
                    href={event.online_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline break-all"
                  >
                    {event.online_url}
                  </a>
                </Detail>
              )}
              {event.capacity && (
                <Detail icon={<Users className="size-4" />} label="Attendance">
                  <span className="font-semibold">{goingCount}</span> going
                  <span className="text-muted-foreground"> / {event.capacity}</span>
                  {waitlistCount > 0 && (
                    <span className="text-muted-foreground">
                      {" · "}
                      <span className="font-semibold text-foreground">{waitlistCount}</span> on waitlist
                    </span>
                  )}
                </Detail>
              )}

            </div>

            <GallerySection eventId={event.id} userHasConfirmedRsvp={rsvp?.status === "confirmed"} />
            <FeedbackSection
              eventId={event.id}
              eventEnded={isPast}
              userHasConfirmedRsvp={rsvp?.status === "confirmed"}
            />
            <div className="mt-10 flex justify-end">
              <ReportButton targetType="event" targetId={event.id} />
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="bg-muted/40 p-6 rounded-2xl ring-1 ring-black/5 sticky top-24">
              {isPast ? (
                <>
                  <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    This event has ended
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Browse upcoming events to find your next one.
                  </p>
                  <Link
                    to="/"
                    className="block text-center w-full bg-foreground text-background font-medium py-3 rounded-xl hover:opacity-90 transition-opacity"
                  >
                    Explore events
                  </Link>
                </>
              ) : rsvp ? (
                <>
                  {rsvp.status === "waitlist" ? (
                    <div className="flex items-center gap-2 text-foreground mb-4">
                      <Hourglass className="size-5" />
                      <p className="text-sm font-semibold">You're on the waitlist</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-success mb-4">
                      <CheckCircle2 className="size-5" />
                      <p className="text-sm font-semibold">You're going</p>
                    </div>
                  )}
                  <div className="bg-surface rounded-xl p-4 ring-1 ring-black/5 mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      {rsvp.status === "waitlist" ? "Waitlist code" : "Ticket code"}
                    </p>
                    <p className="font-mono text-lg font-semibold">{rsvp.ticket_code}</p>
                    {rsvp.status === "waitlist" && (
                      <p className="text-xs text-muted-foreground mt-2">
                        We'll automatically promote you if a confirmed spot opens up.
                      </p>
                    )}
                  </div>
                  {rsvp.status === "confirmed" && (
                    <>
                      <button
                        onClick={handleAddToCalendar}
                        className="w-full bg-foreground text-background font-medium py-3 rounded-xl hover:opacity-90 transition-opacity mb-3 flex items-center justify-center gap-2"
                      >
                        <Calendar className="size-4" />
                        Add to Calendar
                      </button>
                      <Link
                        to="/my-tickets"
                        className="block text-center w-full bg-surface ring-1 ring-black/5 font-medium py-3 rounded-xl hover:bg-muted transition-colors flex items-center justify-center gap-2 mb-3"
                      >
                        <Ticket className="size-4" />
                        View ticket
                      </Link>
                    </>
                  )}
                  <button
                    onClick={handleCancel}
                    disabled={submitting}
                    className="w-full text-xs font-medium text-muted-foreground hover:text-foreground py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                    {submitting ? "Cancelling…" : "Cancel RSVP"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold mb-1">Free RSVP</p>
                  <p className="text-xs text-muted-foreground mb-6">
                    {soldOut
                      ? "This event is full — join the waitlist and we'll promote you if a spot opens."
                      : "Reserve your spot in seconds."}
                  </p>
                  <button
                    onClick={handleRsvp}
                    disabled={submitting}
                    className="w-full bg-brand text-brand-foreground font-medium py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? soldOut
                        ? "Joining waitlist…"
                        : "Reserving…"
                      : !user
                        ? "Sign in to RSVP"
                        : soldOut
                          ? "Join waitlist"
                          : "RSVP — Get ticket"}
                  </button>
                  {!user && (
                    <p className="text-[11px] text-center text-muted-foreground mt-3">
                      You'll be returned here after sign in.
                    </p>
                  )}
                </>
              )}

            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium">{children}</p>
    </div>
  );
}
