import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, User, Bell, Settings as SettingsIcon, Menu, Send, Info, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GlobalSearch } from "@/components/GlobalSearch";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import logoMR from "@/assets/logo-mr-128.png";

export function SiteHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications-unread", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications" as never)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .is("read_at", null);
      return count ?? 0;
    },
  });
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2 text-sm font-bold tracking-tight">
          <img src={logoMR} alt="Media Rosenqvist logo" width={28} height={28} className="h-7 w-7 flex-shrink-0 object-contain" />
          <span className="truncate">Media Rosenqvist</span>
        </Link>
        <div className="flex flex-1 justify-center px-1 sm:px-2">
          <GlobalSearch />
        </div>
        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 text-sm md:flex">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-1.5 text-foreground bg-secondary" }}
          >
            {t("nav.home")}
          </Link>
          <Link
            to="/about"
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-1.5 text-foreground bg-secondary" }}
          >
            {t("nav.about")}
          </Link>
          <Link
            to="/catalog"
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-1.5 text-foreground bg-secondary" }}
          >
            {t("nav.catalog")}
          </Link>
          <Link
            to="/releases/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            activeProps={{ className: "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm ring-2 ring-primary/40" }}
          >
            <Send className="h-3.5 w-3.5" />
            {t("nav.submitMusic")}
            <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {t("nav.demo")}
            </span>
          </Link>
          {user ? (
            <>
              <Link
                to="/upload"
                className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
                activeProps={{ className: "rounded-md px-3 py-1.5 text-foreground bg-secondary" }}
              >
                {t("nav.upload")}
              </Link>
              <Link
                to="/my-submissions"
                className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
                activeProps={{ className: "rounded-md px-3 py-1.5 text-foreground bg-secondary" }}
              >
                {t("nav.mine")}
              </Link>
              <Link
                to="/stats"
                className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                activeProps={{ className: "rounded-md px-3 py-1.5 text-foreground bg-secondary inline-flex items-center gap-1.5" }}
              >
                <BarChart3 className="h-4 w-4" />
                {t("nav.stats")}
              </Link>
              <Link
                to="/notifications"
                className="relative rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                activeProps={{ className: "relative rounded-md px-3 py-1.5 text-foreground bg-secondary inline-flex items-center gap-1.5" }}
                aria-label={t("nav.notifications")}
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link
                to="/settings"
                className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground inline-flex items-center"
                activeProps={{ className: "rounded-md px-3 py-1.5 text-foreground bg-secondary inline-flex items-center" }}
                aria-label={t("nav.settings")}
              >
                <SettingsIcon className="h-4 w-4" />
              </Link>
              <Link
                to="/admin"
                className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
                activeProps={{ className: "rounded-md px-3 py-1.5 text-foreground bg-secondary" }}
              >
                {t("nav.admin")}
              </Link>
              <span className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1.5 text-xs text-foreground">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="max-w-[160px] truncate">{user.name || user.email || t("nav.signedIn")}</span>
              </span>
              <button
                onClick={async () => {
                  await logout();
                  navigate({ to: "/" });
                }}
                className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-foreground hover:bg-secondary"
                aria-label={t("nav.signOut")}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("nav.signOut")}</span>
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="ml-2 rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-secondary"
            >
              {t("nav.signIn")}
            </Link>
          )}
          <span className="ml-2">
            <LanguageSwitcher />
          </span>
        </nav>

        {/* Mobile nav trigger */}
        <div className="flex items-center gap-1 md:hidden">
          <LanguageSwitcher />
          {user && (
            <Link
              to="/notifications"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label={t("nav.notifications")}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          )}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-secondary"
              aria-label={t("common.menu")}
            >
              <Menu className="h-4 w-4" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="border-b border-border p-4 text-left">
                <SheetTitle className="text-base">{t("common.menu")}</SheetTitle>
                {user ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span className="truncate">{user.name || user.email}</span>
                  </span>
                ) : null}
              </SheetHeader>
              <nav className="flex flex-col p-2 text-sm">
                <MobileNavLink to="/" exact onSelect={() => setMenuOpen(false)}>{t("nav.home")}</MobileNavLink>
                <MobileNavLink to="/about" onSelect={() => setMenuOpen(false)}>
                  <span className="inline-flex items-center gap-2">
                    <Info className="h-4 w-4" /> {t("nav.about")}
                  </span>
                </MobileNavLink>
                <MobileNavLink to="/catalog" onSelect={() => setMenuOpen(false)}>{t("nav.catalog")}</MobileNavLink>
                <MobileNavLink to="/releases/new" onSelect={() => setMenuOpen(false)}>
                  <span className="inline-flex items-center gap-2 font-medium text-primary">
                    <Send className="h-4 w-4" /> {t("nav.submitMusic")}
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      {t("nav.demo")}
                    </span>
                  </span>
                </MobileNavLink>
                {user ? (
                  <>
                    <MobileNavLink to="/upload" onSelect={() => setMenuOpen(false)}>{t("nav.upload")}</MobileNavLink>
                    <MobileNavLink to="/my-submissions" onSelect={() => setMenuOpen(false)}>{t("nav.mine")}</MobileNavLink>
                    <MobileNavLink to="/stats" onSelect={() => setMenuOpen(false)}>
                      <span className="inline-flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" /> {t("nav.stats")}
                      </span>
                    </MobileNavLink>
                    <MobileNavLink to="/notifications" onSelect={() => setMenuOpen(false)}>
                      <span className="inline-flex items-center gap-2">
                        <Bell className="h-4 w-4" /> {t("nav.notifications")}
                        {unread > 0 && (
                          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </span>
                    </MobileNavLink>
                    <MobileNavLink to="/settings" onSelect={() => setMenuOpen(false)}>
                      <span className="inline-flex items-center gap-2">
                        <SettingsIcon className="h-4 w-4" /> {t("nav.settings")}
                      </span>
                    </MobileNavLink>
                    <MobileNavLink to="/admin" onSelect={() => setMenuOpen(false)}>{t("nav.admin")}</MobileNavLink>
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        await logout();
                        navigate({ to: "/" });
                      }}
                      className="mt-2 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-foreground hover:bg-secondary"
                    >
                      <LogOut className="h-4 w-4" /> {t("nav.signOut")}
                    </button>
                  </>
                ) : (
                  <MobileNavLink to="/login" onSelect={() => setMenuOpen(false)}>{t("nav.signIn")}</MobileNavLink>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function MobileNavLink({
  to,
  exact,
  children,
  onSelect,
}: {
  to: string;
  exact?: boolean;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Link
      to={to}
      activeOptions={exact ? { exact: true } : undefined}
      onClick={onSelect}
      className="rounded-md px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
      activeProps={{ className: "rounded-md px-3 py-2 text-foreground bg-secondary" }}
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="mt-16 border-t border-border bg-background/50">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <span>© {new Date().getFullYear()} Media Rosenqvist</span>
        <span>{t("footer.api")}</span>
      </div>
    </footer>
  );
}