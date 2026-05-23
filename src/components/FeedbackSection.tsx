import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Star } from "lucide-react";

interface FeedbackRow {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export function FeedbackSection({
  eventId,
  eventEnded,
  userHasConfirmedRsvp,
}: {
  eventId: string;
  eventEnded: boolean;
  userHasConfirmedRsvp: boolean;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("event_feedback" as never)
      .select("id,user_id,rating,comment,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as FeedbackRow[]);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const myFeedback = user ? items.find((i) => i.user_id === user.id) : undefined;
  const canSubmit = !!user && eventEnded && userHasConfirmedRsvp && !myFeedback;
  const avg = items.length ? items.reduce((s, i) => s + i.rating, 0) / items.length : 0;

  async function submit() {
    if (!user || rating === 0) return;
    setSubmitting(true);
    const { error } = await supabase.from("event_feedback" as never).insert({
      event_id: eventId,
      user_id: user.id,
      rating,
      comment: comment.trim() || null,
    } as never);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks for your feedback!");
    setRating(0);
    setComment("");
    load();
  }

  return (
    <section className="mt-12 border-t border-border pt-8">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-lg font-semibold">Attendee feedback</h2>
        {items.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{avg.toFixed(1)}</span> · {items.length}{" "}
            {items.length === 1 ? "review" : "reviews"}
          </p>
        )}
      </div>

      {canSubmit && (
        <div className="bg-muted/40 rounded-2xl ring-1 ring-black/5 p-5 mb-6">
          <p className="text-sm font-medium mb-3">Share how it went</p>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className="p-1"
                aria-label={`${n} stars`}
              >
                <Star
                  className={`size-6 ${
                    (hover || rating) >= n
                      ? "fill-brand text-brand"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder="Optional comment…"
            rows={2}
            className="w-full bg-background ring-1 ring-black/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={submit}
              disabled={submitting || rating === 0}
              className="bg-brand text-brand-foreground font-medium px-4 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm"
            >
              Submit feedback
            </button>
          </div>
        </div>
      )}

      {!canSubmit && eventEnded && user && !userHasConfirmedRsvp && !myFeedback && (
        <p className="text-sm text-muted-foreground mb-4">
          Only confirmed attendees can leave feedback.
        </p>
      )}
      {!eventEnded && (
        <p className="text-sm text-muted-foreground mb-4">
          Feedback opens after the event ends.
        </p>
      )}
      {myFeedback && (
        <p className="text-sm text-muted-foreground mb-4">You've already submitted feedback.</p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.id} className="bg-surface rounded-xl ring-1 ring-black/5 p-4">
              <div className="flex gap-0.5 mb-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`size-3.5 ${
                      i.rating >= n ? "fill-brand text-brand" : "text-muted-foreground/40"
                    }`}
                  />
                ))}
              </div>
              {i.comment && <p className="text-sm text-pretty">{i.comment}</p>}
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">
                {new Date(i.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
