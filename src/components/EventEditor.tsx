import { useState, type FormEvent } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock } from "lucide-react";

export interface EventDraft {
  title: string;
  description: string;
  starts_at: string; // datetime-local
  ends_at: string;
  timezone: string;
  venue: string;
  online_url: string;
  capacity: string;
  cover_image_url: string;
  visibility: "public" | "unlisted";
  is_paid: boolean;
}

export const emptyDraft: EventDraft = {
  title: "",
  description: "",
  starts_at: "",
  ends_at: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  venue: "",
  online_url: "",
  capacity: "",
  cover_image_url: "",
  visibility: "public",
  is_paid: false,
};

export function EventEditor({
  initial,
  submitLabel,
  onSubmit,
  submitting,
}: {
  initial: EventDraft;
  submitLabel: string;
  onSubmit: (d: EventDraft) => void;
  submitting?: boolean;
}) {
  const [d, setD] = useState<EventDraft>(initial);

  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setD((s) => ({ ...s, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!d.title.trim() || !d.starts_at) return;
    onSubmit(d);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Title" required>
        <input className="input" required maxLength={200} value={d.title} onChange={(e) => set("title", e.target.value)} />
      </Field>
      <Field label="Description">
        <textarea className="input resize-none" rows={5} maxLength={4000} value={d.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Starts at" required>
          <input type="datetime-local" className="input" required value={d.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
        </Field>
        <Field label="Ends at">
          <input type="datetime-local" className="input" value={d.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
        </Field>
      </div>
      <Field label="Timezone">
        <input className="input" value={d.timezone} onChange={(e) => set("timezone", e.target.value)} maxLength={64} placeholder="e.g. Europe/Berlin" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Venue address">
          <input className="input" value={d.venue} onChange={(e) => set("venue", e.target.value)} maxLength={300} placeholder="123 Main St, Berlin" />
        </Field>
        <Field label="Online link">
          <input type="url" className="input" value={d.online_url} onChange={(e) => set("online_url", e.target.value)} placeholder="https://…" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Capacity">
          <input type="number" min={0} className="input" value={d.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="Unlimited" />
        </Field>
        <Field label="Cover image URL">
          <input type="url" className="input" value={d.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)} placeholder="https://…" />
        </Field>
      </div>

      <Field label="Visibility">
        <div className="flex gap-2 p-1 bg-muted rounded-xl ring-1 ring-black/5 w-fit">
          {(["public", "unlisted"] as const).map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => set("visibility", v)}
              className={`text-sm px-4 py-1.5 rounded-lg font-medium capitalize transition-all ${
                d.visibility === v ? "bg-surface shadow-sm ring-1 ring-black/5" : "text-muted-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {d.visibility === "public" ? "Listed in Explore and accessible by link." : "Hidden from Explore — only people with the link can see it."}
        </p>
      </Field>

      <Field label="Pricing">
        <TooltipProvider delayDuration={100}>
          <div className="flex gap-2 p-1 bg-muted rounded-xl ring-1 ring-black/5 w-fit">
            <button
              type="button"
              onClick={() => set("is_paid", false)}
              className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-all ${
                !d.is_paid ? "bg-surface shadow-sm ring-1 ring-black/5" : "text-muted-foreground"
              }`}
            >
              Free
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <button
                    type="button"
                    disabled
                    aria-disabled
                    className="text-sm px-4 py-1.5 rounded-lg font-medium text-muted-foreground opacity-60 cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    <Lock className="size-3" />
                    Paid
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-brand text-brand-foreground font-medium py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {submitting ? "Saving…" : submitLabel}
      </button>
      <style>{`.input{width:100%;background:var(--color-surface);border:1px solid var(--color-border);border-radius:.75rem;padding:.625rem .875rem;font-size:.875rem;outline:none;transition:all .15s}.input:focus{border-color:var(--color-brand);box-shadow:0 0 0 3px color-mix(in oklab, var(--color-brand) 15%, transparent)}`}</style>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}{required && <span className="text-brand"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function toDbPayload(d: EventDraft) {
  return {
    title: d.title.trim(),
    description: d.description.trim(),
    starts_at: new Date(d.starts_at).toISOString(),
    ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null,
    timezone: d.timezone.trim() || "UTC",
    venue: d.venue.trim() || null,
    online_url: d.online_url.trim() || null,
    capacity: d.capacity ? Number(d.capacity) : null,
    cover_image_url: d.cover_image_url.trim() || null,
    visibility: d.visibility,
    is_paid: d.is_paid,
  };
}

export function fromDbRow(r: {
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  venue: string | null;
  online_url: string | null;
  capacity: number | null;
  cover_image_url: string | null;
  visibility: string | null;
  is_paid: boolean | null;
}): EventDraft {
  const toLocal = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return {
    title: r.title,
    description: r.description ?? "",
    starts_at: toLocal(r.starts_at),
    ends_at: toLocal(r.ends_at),
    timezone: r.timezone ?? "UTC",
    venue: r.venue ?? "",
    online_url: r.online_url ?? "",
    capacity: r.capacity ? String(r.capacity) : "",
    cover_image_url: r.cover_image_url ?? "",
    visibility: (r.visibility as "public" | "unlisted") ?? "public",
    is_paid: !!r.is_paid,
  };
}
