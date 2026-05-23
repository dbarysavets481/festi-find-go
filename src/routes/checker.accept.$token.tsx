import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav } from "@/components/SiteNav";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/checker/accept/$token")({
  component: AcceptCheckerPage,
});

function AcceptCheckerPage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: `/checker/accept/${token}` } });
      return;
    }
    (async () => {
      setStatus("working");
      const { error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>)(
        "redeem_checker_invite",
        { _token: token },
      );
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      setStatus("done");
      toast.success("You're now a checker!");
      setTimeout(() => navigate({ to: "/checker" }), 800);
    })();
  }, [loading, user, token, navigate]);

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="max-w-md mx-auto px-6 py-24 text-center">
        <ShieldCheck className="size-12 mx-auto text-brand mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Checker invite</h1>
        {status === "working" && <p className="text-muted-foreground">Accepting invite…</p>}
        {status === "done" && <p className="text-success">Accepted. Redirecting…</p>}
        {status === "error" && (
          <p className="text-destructive text-sm">{message || "Could not accept invite."}</p>
        )}
      </main>
    </div>
  );
}
