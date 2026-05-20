import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/SiteNav";
import { EventCard, type EventLike } from "@/components/EventCard";
import { Search } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Explore events — Phase" },
      { name: "description", content: "Browse upcoming and past events near you." },
    ],
  }),
  component: ExplorePage,
});

type Event = EventLike & { description: string };

function ExplorePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [dateFilter, setDateFilter] = useState<"any" | "today" | "week" | "month">("any");
  const [locationFilter, setLocationFilter] = useState<string>("any");

  useEffect(() => {
    supabase
      .from("events")
      .select("id,title,description,starts_at,venue,online_url,location,cover_image_url,capacity")
      .eq("status", "published")
      .eq("visibility", "public")
      .order("starts_at", { ascending: true })
      .then(({ data }) => {
        setEvents((data ?? []) as Event[]);
        setLoading(false);
      });
  }, []);

  const locations = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (e.location) set.add(e.location);
    });
    return Array.from(set);
  }, [events]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return events.filter((e) => {
      const ts = new Date(e.starts_at).getTime();
      const isPast = ts < now;
      if (showPast ? !isPast : isPast) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !e.title.toLowerCase().includes(q) &&
          !(e.description ?? "").toLowerCase().includes(q) &&
          !(e.venue ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      if (dateFilter !== "any" && !isPast) {
        const days = dateFilter === "today" ? 1 : dateFilter === "week" ? 7 : 30;
        if (ts > now + days * 86400000) return false;
      }
      if (locationFilter !== "any" && e.location !== locationFilter) return false;
      return true;
    });
  }, [events, query, showPast, dateFilter, locationFilter]);

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="max-w-7xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-semibold mb-2 text-balance max-w-[20ch]">
            Find the rhythm of your city
          </h1>
          <p className="text-muted-foreground mb-8">
            Discover what's on this week and beyond.
          </p>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div className="lg:w-96">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Search events
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Music, art, or workshops..."
                  className="w-full bg-muted border-none ring-1 ring-black/5 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-brand focus:bg-surface transition-all outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 p-1 bg-muted rounded-xl ring-1 ring-black/5 w-fit">
              <button
                onClick={() => setShowPast(false)}
                className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-all ${
                  !showPast ? "bg-surface shadow-sm ring-1 ring-black/5" : "text-muted-foreground"
                }`}
              >
                Upcoming
              </button>
              <button
                onClick={() => setShowPast(true)}
                className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-all ${
                  showPast ? "bg-surface shadow-sm ring-1 ring-black/5" : "text-muted-foreground"
                }`}
              >
                Past
              </button>
            </div>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
              className="bg-surface ring-1 ring-black/5 rounded-lg py-2 px-3 text-sm font-medium outline-none focus:ring-brand"
            >
              <option value="any">Any date</option>
              <option value="today">Next 24h</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="bg-surface ring-1 ring-black/5 rounded-lg py-2 px-3 text-sm font-medium outline-none focus:ring-brand"
            >
              <option value="any">Any location</option>
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </header>

        {loading ? (
          <div className="text-muted-foreground text-sm">Loading events…</div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground">
            No events match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((e) => (
              <EventCard key={e.id} event={e} ended={showPast} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
