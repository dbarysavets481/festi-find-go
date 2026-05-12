import warehouse from "@/assets/event-warehouse.jpg";
import gallery from "@/assets/event-gallery.jpg";
import courtyard from "@/assets/event-courtyard.jpg";
import synth from "@/assets/event-synth.jpg";
import conference from "@/assets/event-conference.jpg";
import bookclub from "@/assets/event-bookclub.jpg";

const map: Record<string, string> = {
  warehouse,
  gallery,
  courtyard,
  synth,
  conference,
  bookclub,
};

export function eventImage(key: string | null | undefined): string {
  if (!key) return gallery;
  if (key.startsWith("http")) return key;
  return map[key] ?? gallery;
}
