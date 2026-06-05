import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setInfo("If an account exists for that email, a reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reset password</h1>
          <p className="mt-2 text-sm text-muted-foreground">We'll email you a link to set a new password.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{error}</p> : null}
          {info ? <p className="rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-primary">{info}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}</Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground"><Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
      </div>
    </div>
  );
}
