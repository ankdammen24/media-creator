import { useState } from "react";
import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { Activity, Disc3, LayoutDashboard, LogOut, Menu, Music, Radio, Upload, UserCircle, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { t } from "@/lib/i18n";

const NAV = [
  { to: "/dashboard", label: "Översikt", icon: LayoutDashboard },
  { to: "/upload", label: "Ladda upp", icon: Upload },
  { to: "/processing", label: "Bearbetning", icon: Activity },
  { to: "/tracks", label: "Mina spår", icon: Music },
  { to: "/releases", label: "Mina releaser", icon: Disc3 },
  { to: "/distribution", label: "Distribution", icon: Radio },
  { to: "/account", label: "Konto", icon: UserCircle },
] as const;

export function AppShell() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
        <SidebarContent onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} email={user?.email} name={user?.name} />
      </aside>
      <div className="flex w-full flex-col md:hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-3">
          <Link to="/dashboard" className="text-lg font-semibold">{t("appName")}</Link>
          <button type="button" onClick={() => setMobileOpen((v) => !v)} className="rounded-md p-2 hover:bg-secondary" aria-label="Öppna meny">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        {mobileOpen ? <div className="border-b border-border bg-sidebar"><SidebarContent onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} email={user?.email} name={user?.name} /></div> : null}
        <main className="flex-1"><Outlet /></main>
      </div>
      <main className="hidden flex-1 md:block"><Outlet /></main>
    </div>
  );
}

function SidebarContent({ onNavigate, onLogout, email, name }: { onNavigate: () => void; onLogout: () => void; email?: string; name?: string }) {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-6 px-2">
        <Link to="/dashboard" className="block text-xl font-semibold" onClick={onNavigate}>{t("appName")}</Link>
        <p className="text-xs text-muted-foreground">Tunn skaparklient</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} onClick={onNavigate} className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent" activeProps={{ className: cn("group flex items-center gap-3 rounded-md px-3 py-2 text-sm", "bg-sidebar-primary text-sidebar-primary-foreground") }}>
            <Icon className="h-4 w-4" />{label}
          </Link>
        ))}
      </nav>
      <div className="mt-4 border-t border-sidebar-border pt-4">
        <div className="mb-3 px-3 text-xs"><div className="truncate font-medium text-sidebar-foreground">{name ?? "—"}</div><div className="truncate text-muted-foreground">{email ?? ""}</div></div>
        <div className="flex items-center gap-2 px-1">
          <ThemeToggle />
          <button type="button" onClick={onLogout} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><LogOut className="h-3.5 w-3.5" />Logga ut</button>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div>{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}</div>;
}

export function PageContainer({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>;
}
