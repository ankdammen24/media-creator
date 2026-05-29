import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Catalogus Musicus" },
      { name: "description", content: "Sign in to Catalogus Musicus." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, signup, user } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/admin" });
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await login(email, password);
        router.invalidate();
        navigate({ to: "/admin" });
      } else {
        await signup(email, password);
        setInfo(t("auth.checkEmail"));
        setMode("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.invalidCredentials"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">{mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}</h1>
            <p className="text-xs text-muted-foreground">Catalogus Musicus</p>
          </div>
        </div>

        <div className="mb-4 inline-flex rounded-md border border-border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); setInfo(null); }}
            className={`rounded px-3 py-1 ${mode === "signin" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
          >
            {t("auth.signInTab")}
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); setInfo(null); }}
            className={`rounded px-3 py-1 ${mode === "signup" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
          >
            {t("auth.signUpTab")}
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              {t("auth.email")}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-60"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              {t("auth.password")}
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-60"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          )}
          {info && (
            <div
              role="status"
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground"
            >
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting
              ? mode === "signin" ? t("auth.signingIn") : t("auth.creatingAccount")
              : mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}
          </button>
        </form>
      </div>
    </div>
  );
}