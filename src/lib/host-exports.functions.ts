import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({ eventId: z.string().uuid() });

export const exportEventRsvpsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorization: must be host or assigned checker for this event
    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("id,title,created_by")
      .eq("id", data.eventId)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!ev) throw new Error("Event not found");

    let authorized = ev.created_by === userId;
    if (!authorized) {
      const { data: c } = await supabase
        .from("event_checkers")
        .select("id")
        .eq("event_id", data.eventId)
        .eq("user_id", userId)
        .maybeSingle();
      authorized = !!c;
    }
    if (!authorized) throw new Error("Forbidden");

    // Fetch RSVPs (admin to ensure complete set regardless of RLS edge cases)
    const { data: rsvps, error: rsvpErr } = await supabaseAdmin
      .from("rsvps")
      .select("user_id,status,ticket_code,checked_in_at,created_at")
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: true });
    if (rsvpErr) throw new Error(rsvpErr.message);

    const rows = rsvps ?? [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

    // Fetch auth user emails + names via admin listUsers (pages)
    const userMap = new Map<string, { email: string; name: string }>();
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      for (const u of list.users) {
        if (userIds.includes(u.id)) {
          const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
          const name =
            (meta.full_name as string) ||
            (meta.name as string) ||
            (meta.display_name as string) ||
            "";
          userMap.set(u.id, { email: u.email ?? "", name });
        }
      }
      if (list.users.length < perPage) break;
      page += 1;
      if (page > 50) break; // safety
    }

    const escape = (val: string) => {
      const needsQuote = /[",\r\n]/.test(val);
      const escaped = val.replace(/"/g, '""');
      return needsQuote ? `"${escaped}"` : escaped;
    };

    const header = ["Name", "Email", "Ticket Code", "RSVP Status", "Check-in Time"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const u = userMap.get(r.user_id) ?? { email: "", name: "" };
      const checkedIn = r.checked_in_at ? new Date(r.checked_in_at).toISOString() : "";
      lines.push(
        [u.name, u.email, r.ticket_code, r.status, checkedIn].map((v) => escape(String(v ?? ""))).join(","),
      );
    }

    // Prepend UTF-8 BOM for Excel compatibility
    const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
    const safeTitle = (ev.title || "event").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);
    return { csv, filename: `${safeTitle}_rsvps.csv` };
  });
