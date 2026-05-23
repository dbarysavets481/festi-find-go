import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav } from "@/components/SiteNav";
import { toast } from "sonner";
import { CheckCircle2, ScanLine, Undo2, ArrowLeft } from "lucide-react";


export const Route = createFileRoute("/host/events/$id/check-in")({
  component: CheckInPage,
});

interface EventRow {
  id: string;
  title: string;
  starts_at: string;
  capacity: number | null;
  created_by: string | null;
}

interface RsvpRow {
  id: string;
  ticket_code: string;
  status: "confirmed" | "waitlist";
  checked_in_at: string | null;
}

function CheckInPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  // host vs checker is irrelevant for check-in UI; both have identical capabilities here
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCheckedInId, setLastCheckedInId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: ev } = await supabase
      .from("events")
      .select("id,title,starts_at,capacity,created_by")
      .eq("id", id)
      .maybeSingle();
    if (!ev) {
      setAuthorized(false);
      return;
    }
    setEvent(ev as EventRow);

    const hostFlag = ev.created_by === user.id;
    let allowed = hostFlag;
    if (!allowed) {
      const [{ data: c }, { data: hc }] = await Promise.all([
        supabase
          .from("event_checkers")
          .select("id")
          .eq("event_id", id)
          .eq("user_id", user.id)
          .maybeSingle(),
        ev.created_by
          ? supabase
              .from("host_checkers" as never)
              .select("id")
              .eq("host_user_id", ev.created_by)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      allowed = !!c || !!hc;
    }
    if (!allowed) {
      setAuthorized(false);
      return;
    }
    setAuthorized(true);

    const { data: rs } = await supabase
      .from("rsvps")
      .select("id,ticket_code,status,checked_in_at")
      .eq("event_id", id);
    setRsvps((rs ?? []) as RsvpRow[]);
  }, [id, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: `/host/events/${id}/check-in` } });
      return;
    }
    load();
  }, [loading, user, navigate, id, load]);

  const confirmed = rsvps.filter((r) => r.status === "confirmed");
  const goingCount = confirmed.length;
  const checkedInCount = confirmed.filter((r) => r.checked_in_at).length;
  const remaining = goingCount - checkedInCount;

  async function handleCheckIn(e?: React.FormEvent) {
    e?.preventDefault();
    const value = code.trim().toUpperCase();
    if (!value) return;
    setBusy(true);
    const match = rsvps.find((r) => r.ticket_code.toUpperCase() === value);
    if (!match) {
      setBusy(false);
      toast.error("Ticket code not found.");
      inputRef.current?.select();
      return;
    }
    if (match.status !== "confirmed") {
      setBusy(false);
      toast.error("Ticket is on the waitlist — not eligible for check-in.");
      return;
    }
    if (match.checked_in_at) {
      setBusy(false);
      toast.error("Already checked in.");
      return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("rsvps")
      .update({ checked_in_at: now, checked_in_by: user!.id })
      .eq("id", match.id);
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    setRsvps((rs) => rs.map((r) => (r.id === match.id ? { ...r, checked_in_at: now } : r)));
    setLastCheckedInId(match.id);
    setCode("");
    setBusy(false);
    toast.success(`Checked in · ${match.ticket_code}`);
    inputRef.current?.focus();
  }

  async function undoLast() {
    if (!lastCheckedInId) return;
    setBusy(true);
    const { error } = await supabase
      .from("rsvps")
      .update({ checked_in_at: null, checked_in_by: null })
      .eq("id", lastCheckedInId);
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    setRsvps((rs) => rs.map((r) => (r.id === lastCheckedInId ? { ...r, checked_in_at: null } : r)));
    setLastCheckedInId(null);
    setBusy(false);
    toast.success("Undid last check-in.");
  }

  if (loading || authorized === null) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <div className="max-w-7xl mx-auto px-6 py-24 text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (authorized === false) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <div className="max-w-7xl mx-auto px-6 py-24">
          <p className="mb-4">You don't have access to check-in for this event.</p>
          <Link to="/host/dashboard" className="text-brand underline">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/host/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold mb-1">Check-in</h1>
          <p className="text-sm text-muted-foreground">{event?.title}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <Stat label="Going" value={goingCount} />
          <Stat label="Checked-in" value={checkedInCount} tone="brand" />
          <Stat label="Remaining" value={remaining} />
        </div>

        <form onSubmit={handleCheckIn} className="bg-surface p-5 rounded-2xl ring-1 ring-black/5 mb-4">
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <ScanLine className="size-4" />
            Ticket code
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. A1B2C3D4E5"
              className="flex-1 bg-background ring-1 ring-black/10 rounded-xl px-4 py-3 font-mono text-lg tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-brand"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="bg-brand text-brand-foreground font-medium px-5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Check in
            </button>
          </div>
        </form>

        <button
          onClick={undoLast}
          disabled={!lastCheckedInId || busy}
          className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed mb-10"
        >
          <Undo2 className="size-4" />
          Undo last check-in
        </button>

        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Recently checked in
        </h2>
        <div className="space-y-2">
          {confirmed
            .filter((r) => r.checked_in_at)
            .sort((a, b) => (b.checked_in_at! > a.checked_in_at! ? 1 : -1))
            .slice(0, 10)
            .map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-2.5 ring-1 ring-black/5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-4 text-success" />
                  <span className="font-mono font-semibold">{r.ticket_code}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.checked_in_at!).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          {checkedInCount === 0 && (
            <p className="text-sm text-muted-foreground">No check-ins yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "brand" }) {
  return (
    <div className="bg-surface rounded-2xl ring-1 ring-black/5 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className={`text-3xl font-semibold tabular-nums ${tone === "brand" ? "text-brand" : ""}`}>{value}</p>
    </div>
  );
}
