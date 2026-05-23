import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Copy, Plus, Trash2, ShieldCheck } from "lucide-react";

interface InviteRow {
  id: string;
  token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
}

interface CheckerRow {
  id: string;
  user_id: string;
  created_at: string;
}

export function CheckerInvitesPanel() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [checkers, setCheckers] = useState<CheckerRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: inv }, { data: ch }] = await Promise.all([
      supabase
        .from("checker_invites" as never)
        .select("id,token,created_at,expires_at,used_at,used_by")
        .eq("host_user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("host_checkers" as never)
        .select("id,user_id,created_at")
        .eq("host_user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setInvites((inv ?? []) as InviteRow[]);
    setCheckers((ch ?? []) as CheckerRow[]);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function createInvite() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("checker_invites" as never)
      .insert({ host_user_id: user.id } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Invite link created.");
    load();
  }

  async function revoke(id: string) {
    const { error } = await supabase.from("checker_invites" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setInvites((rows) => rows.filter((r) => r.id !== id));
  }

  async function removeChecker(id: string) {
    const { error } = await supabase.from("host_checkers" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setCheckers((rows) => rows.filter((r) => r.id !== id));
  }

  function inviteLink(token: string) {
    return `${window.location.origin}/checker/accept/${token}`;
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied.");
  }

  return (
    <section className="bg-surface rounded-2xl ring-1 ring-black/5 p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-brand" />
          <h2 className="font-semibold">Checkers</h2>
        </div>
        <button
          onClick={createInvite}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          New invite link
        </button>
      </div>

      {invites.filter((i) => !i.used_at).length === 0 && checkers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No checkers yet. Create an invite link and share it with people who'll help with check-in.
        </p>
      )}

      {invites.filter((i) => !i.used_at).length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Pending invites
          </p>
          {invites
            .filter((i) => !i.used_at)
            .map((i) => (
              <div
                key={i.id}
                className="flex items-center gap-2 bg-background ring-1 ring-black/5 rounded-lg px-3 py-2"
              >
                <input
                  readOnly
                  value={inviteLink(i.token)}
                  className="flex-1 bg-transparent text-xs font-mono truncate outline-none"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => copy(inviteLink(i.token))}
                  className="p-1.5 rounded hover:bg-muted"
                  title="Copy link"
                >
                  <Copy className="size-3.5" />
                </button>
                <button
                  onClick={() => revoke(i.id)}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                  title="Revoke"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
        </div>
      )}

      {checkers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Active checkers
          </p>
          {checkers.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between bg-background ring-1 ring-black/5 rounded-lg px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground truncate">{c.user_id}</span>
              <button
                onClick={() => removeChecker(c.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
