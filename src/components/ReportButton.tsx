import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Flag } from "lucide-react";

export function ReportButton({
  targetType,
  targetId,
  compact,
}: {
  targetType: "event" | "photo";
  targetId: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user) return toast.error("Sign in to report.");
    if (!reason.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("reports" as never).insert({
      target_type: targetType,
      target_id: targetId,
      reporter_id: user.id,
      reason: reason.trim().slice(0, 500),
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Report submitted. Thank you.");
    setReason("");
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex items-center gap-1 text-xs font-medium bg-background/90 hover:bg-background px-2 py-1 rounded ring-1 ring-black/10"
            : "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        }
      >
        <Flag className="size-3" />
        Report
      </button>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background rounded-2xl p-6 max-w-md w-full ring-1 ring-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-1">Report {targetType}</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Tell us what's wrong. Hosts will review.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Reason…"
              className="w-full bg-muted/40 ring-1 ring-black/5 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setOpen(false)}
                className="text-sm font-medium px-3 py-2 rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={busy || !reason.trim()}
                className="text-sm font-medium px-3 py-2 rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-50"
              >
                Submit report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
