import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export function SiteNav() {
  const { user, signOut } = useAuth();
  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-brand font-semibold tracking-tight text-lg">
            PHASE
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-foreground" }}
              className="hover:text-foreground transition-colors"
            >
              Explore
            </Link>
            <Link
              to="/my-tickets"
              activeProps={{ className: "text-foreground" }}
              className="hover:text-foreground transition-colors"
            >
              My Tickets
            </Link>
            <Link
              to="/host/dashboard"
              activeProps={{ className: "text-foreground" }}
              className="hover:text-foreground transition-colors"
            >
              Host
            </Link>
            <Link
              to="/checker"
              activeProps={{ className: "text-foreground" }}
              className="hover:text-foreground transition-colors"
            >
              Checker
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden sm:inline text-xs text-muted-foreground mr-2">
                {user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="text-sm font-medium px-4 py-2 hover:bg-muted rounded-lg transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium px-4 py-2 hover:bg-muted rounded-lg transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="text-sm font-medium bg-foreground text-background px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                Join now
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
