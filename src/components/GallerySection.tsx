import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";
import { ReportButton } from "./ReportButton";

interface PhotoRow {
  id: string;
  image_url: string;
  user_id: string;
  status: string;
  created_at: string;
}

export function GallerySection({
  eventId,
  userHasConfirmedRsvp,
}: {
  eventId: string;
  userHasConfirmedRsvp: boolean;
}) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    // Public approved photos
    const { data: approved } = await supabase
      .from("event_photos" as never)
      .select("id,image_url,user_id,status,created_at")
      .eq("event_id", eventId)
      .eq("status", "approved")
      .eq("hidden", false)
      .order("created_at", { ascending: false });
    let rows = ((approved ?? []) as PhotoRow[]);
    // Plus the current user's own pending uploads
    if (user) {
      const { data: own } = await supabase
        .from("event_photos" as never)
        .select("id,image_url,user_id,status,created_at")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .neq("status", "approved");
      const ownRows = (own ?? []) as PhotoRow[];
      const seen = new Set(rows.map((r) => r.id));
      rows = [...ownRows.filter((r) => !seen.has(r.id)), ...rows];
    }
    setPhotos(rows);
  }, [eventId, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Max 8 MB.");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${eventId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("event-photos").upload(path, file, {
      contentType: file.type,
    });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("event-photos").getPublicUrl(path);
    const { error } = await supabase.from("event_photos" as never).insert({
      event_id: eventId,
      user_id: user.id,
      image_url: pub.publicUrl,
      storage_path: path,
    } as never);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (error) return toast.error(error.message);
    toast.success("Photo submitted! Awaiting host approval.");
    load();
  }

  return (
    <section className="mt-12 border-t border-border pt-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold">Gallery</h2>
        {userHasConfirmedRsvp && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
              {uploading ? "Uploading…" : "Upload photo"}
            </button>
          </>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative aspect-square rounded-xl overflow-hidden bg-muted ring-1 ring-black/5 group"
            >
              <img src={p.image_url} alt="" className="w-full h-full object-cover" />
              {p.status !== "approved" && (
                <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-background/90 px-2 py-0.5 rounded">
                  {p.status}
                </span>
              )}
              {p.status === "approved" && user && (
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ReportButton targetType="photo" targetId={p.id} compact />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
