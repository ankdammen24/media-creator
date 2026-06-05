import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({ component: RegisterPage });

function RegisterPage() {
  const { user, loading, signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await signup(email, password, displayName || undefined);
      setInfo("Check your email to confirm your account, then sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Crystal Pier Records</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Creator Portal</p>
          <p className="mt-4 text-sm text-muted-foreground">Create your creator account</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-1.5"><Label htmlFor="name">Display name</Label><Input id="name" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" /></div>
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{error}</p> : null}
          {info ? <p className="rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-primary">{info}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}</Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">Already have one? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></p>
        <p className="mt-6 text-center text-[11px] text-muted-foreground">Crystal Pier Records is part of Media Rosenqvist.</p>
      </div>
    </div>
  );
}
