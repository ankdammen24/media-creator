import { Link, useNavigate } from "@tanstack/react-router";
import { Waves, LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function SiteHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Waves className="h-4 w-4" />
          </span>
          <span>Soundloom <span className="text-muted-foreground font-normal">Core</span></span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-1.5 text-foreground bg-secondary" }}
          >
            Home
          </Link>
          <Link
            to="/catalog"
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-1.5 text-foreground bg-secondary" }}
          >
            Catalog
          </Link>
          {user ? (
            <>
              <Link
                to="/admin"
                className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
                activeProps={{ className: "rounded-md px-3 py-1.5 text-foreground bg-secondary" }}
              >
                Admin
              </Link>
              <span className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1.5 text-xs text-foreground">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="max-w-[160px] truncate">{user.name || user.email || "Signed in"}</span>
              </span>
              <button
                onClick={() => {
                  logout();
                  navigate({ to: "/" });
                }}
                className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-foreground hover:bg-secondary"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="ml-2 rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-secondary"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-background/50">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <span>© {new Date().getFullYear()} Media Rosenqvist · Soundloom Core</span>
        <span>media-catalog API</span>
      </div>
    </footer>
  );
}