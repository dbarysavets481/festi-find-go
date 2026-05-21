import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { exportEventRsvpsCsv } from "@/lib/host-exports.functions";

export function ExportCsvButton({
  eventId,
  variant = "ghost",
  label = "Export CSV",
}: {
  eventId: string;
  variant?: "ghost" | "ring";
  label?: string;
}) {
  const fn = useServerFn(exportEventRsvpsCsv);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const { csv, filename } = await fn({ data: { eventId } });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export ready.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  const cls =
    variant === "ring"
      ? "inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg hover:bg-muted ring-1 ring-black/5 disabled:opacity-50"
      : "inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-muted disabled:opacity-50";

  return (
    <button onClick={onClick} disabled={busy} className={cls}>
      <Download className={variant === "ring" ? "size-4" : "size-3.5"} />
      {busy ? "Exporting…" : label}
    </button>
  );
}
