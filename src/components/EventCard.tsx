import { Link } from "@tanstack/react-router";
import { eventImage } from "@/lib/event-images";

export interface EventLike {
  id: string;
  title: string;
  starts_at: string;
  venue: string | null;
  online_url: string | null;
  location: string | null;
  cover_image_url: string | null;
  capacity: number | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventCard({ event, ended }: { event: EventLike; ended?: boolean }) {
  const where = event.venue ?? (event.online_url ? "Online" : event.location ?? "TBA");
  return (
    <Link
      to="/events/$id"
      params={{ id: event.id }}
      className="group block"
    >
      <div className="relative w-full aspect-[4/5] bg-muted rounded-2xl overflow-hidden mb-4 ring-1 ring-black/5">
        <img
          src={eventImage(event.cover_image_url)}
          alt={event.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {ended && (
          <div className="absolute inset-0 bg-black/40 grid place-items-center">
            <span className="rounded-full bg-background px-4 py-1 text-xs font-bold uppercase tracking-widest">
              Ended
            </span>
          </div>
        )}
        {!ended && event.capacity && event.capacity <= 20 && (
          <div className="absolute top-3 left-3">
            <span className="px-2 py-1 bg-brand text-brand-foreground text-[10px] font-bold uppercase tracking-wider rounded">
              Limited
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-between items-start mb-1">
        <span className={`text-sm font-medium ${ended ? "text-muted-foreground" : "text-brand"}`}>
          {formatDate(event.starts_at)}
        </span>
      </div>
      <h3 className="text-lg font-semibold mb-1 text-balance leading-snug group-hover:text-brand transition-colors">
        {event.title}
      </h3>
      <p className="text-sm text-muted-foreground">{where}</p>
    </Link>
  );
}
