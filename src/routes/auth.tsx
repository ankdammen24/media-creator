import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({ component: AuthPage });

type Mode = "sign-in" | "sign-up";

function AuthPage() {
  const { user, loading, login, signup, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Laddar…</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "sign-in") {
        await login(email, password);
        router.navigate({ to: "/dashboard", replace: true });
      } else {
        await signup(email, password, displayName || undefined);
        setInfo("Kontrollera din e-post för att bekräfta kontot innan du loggar in.");
        setMode("sign-in");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google-inloggning misslyckades");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Crystal Pier Records</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Creator Portal</p>
          <p className="mt-4 text-sm text-muted-foreground">{mode === "sign-in" ? "Sign in to Crystal Pier Records Creator Portal" : "Create your Crystal Pier creator account"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Manage your uploads, tracks, releases, and distribution status.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          {mode === "sign-up" ? <div className="space-y-1.5"><Label htmlFor="name">Visningsnamn</Label><Input id="name" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ditt namn" /></div> : null}
          <div className="space-y-1.5"><Label htmlFor="email">E-post</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="password">Lösenord</Label><Input id="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{error}</p> : null}
          {info ? <p className="rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-primary">{info}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "sign-in" ? "Logga in" : "Skapa konto"}</Button>
          <div className="relative py-2"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div><div className="relative flex justify-center text-[10px] uppercase tracking-wider text-muted-foreground"><span className="bg-card px-2">eller</span></div></div>
          <Button type="button" variant="outline" className="w-full" onClick={onGoogle} disabled={busy}>Fortsätt med Google</Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">{mode === "sign-in" ? "No account yet?" : "Already have an account?"} <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(null); setInfo(null); }}>{mode === "sign-in" ? "Create one" : "Sign in"}</button></p>
        <p className="mt-6 text-center text-[11px] text-muted-foreground">Crystal Pier Records is part of Media Rosenqvist.</p>

      </div>
    </div>
  );
}
