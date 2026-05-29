import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import appCss from "../styles.css?url";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { AuthProvider, useAuth } from "@/lib/auth";
import { PlayerProvider, usePlayer } from "@/components/player/PlayerProvider";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { ThemeProvider } from "@/components/theme-provider";
import { setAppLanguage, type AppLang } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

const noFlashScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');else r.classList.remove('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("notFound.body")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("common.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("errorBoundary.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("errorBoundary.body")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("common.tryAgain")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("common.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Catalogus Musicus" },
      { name: "description", content: "Music Catalog for a reason" },
      { name: "author", content: "Media Rosenqvist" },
      { property: "og:site_name", content: "Catalogus Musicus" },
      { property: "og:title", content: "Catalogus Musicus" },
      { property: "og:description", content: "Music Catalog for a reason" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Catalogus Musicus" },
      { name: "twitter:description", content: "Music Catalog for a reason" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/1940bfc9-6bf9-44fb-8bc2-b97a5c417db7" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/1940bfc9-6bf9-44fb-8bc2-b97a5c417db7" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <PlayerProvider>
            <LanguageSync />
            <AppShell />
          </PlayerProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function LanguageSync() {
  const { user } = useAuth();
  const { i18n } = useTranslation();

  // After hydration, restore language from localStorage / browser preference.
  // Done in an effect (not at i18n init) to keep SSR and first client render
  // deterministic and avoid hydration mismatch.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem("i18nextLng");
    } catch {
      /* ignore */
    }
    const nav = (typeof navigator !== "undefined" ? navigator.language : "")
      .slice(0, 2)
      .toLowerCase();
    const pick = stored === "sv" || stored === "en"
      ? stored
      : nav === "en"
      ? "en"
      : "sv";
    if (pick !== (i18n.resolvedLanguage ?? i18n.language)) {
      setAppLanguage(pick as AppLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep <html lang> in sync with the active language.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = (i18n.resolvedLanguage ?? i18n.language ?? "sv").slice(0, 2);
  }, [i18n.resolvedLanguage, i18n.language]);

  // When a user signs in, hydrate their preferred language from profiles.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const v = (data as { preferred_language?: string } | null)?.preferred_language;
      if (v === "sv" || v === "en") setAppLanguage(v as AppLang);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return null;
}

function AppShell() {
  const { current } = usePlayer();
  return (
    <>
      <div
        className="flex min-h-screen flex-col"
        style={
          current
            ? { paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }
            : undefined
        }
      >
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <MiniPlayer />
    </>
  );
}
