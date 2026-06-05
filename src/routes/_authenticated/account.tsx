import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { creatorQueryKeys, getMe, updateAccount } from "@/lib/api-creator";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, useMyRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/account")({ component: AccountPage });

function AccountPage() {
  const { user, session, logout } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: creatorQueryKeys.me, queryFn: getMe, retry: 0 });
  const myRoles = useMyRoles();
  const update = useMutation({ mutationFn: (patch: { displayName?: string }) => updateAccount(patch), onSuccess: () => qc.invalidateQueries({ queryKey: creatorQueryKeys.me }) });
  const [displayName, setDisplayName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  useEffect(() => { setDisplayName(me.data?.displayName ?? user?.name ?? ""); }, [me.data, user]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await update.mutateAsync({ displayName });
      setMsg("Saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwErr(null); setPwMsg(null);
    if (newPassword.length < 8) return setPwErr("Password must be at least 8 characters.");
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setPwMsg("Password updated.");
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setPwBusy(false);
    }
  }

  async function onLogout() {
    await logout();
    router.navigate({ to: "/login", replace: true });
  }

  return (
    <PageContainer>
      <PageHeader title="Account" description="Manage your profile, password, and session." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <form onSubmit={onSave} className="space-y-5 rounded-xl border border-border bg-card p-6">
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" value={me.data?.email ?? user?.email ?? ""} readOnly disabled /></div>
            <div className="space-y-1.5"><Label htmlFor="name">Display name</Label><Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" /></div>
            <div className="flex flex-wrap items-center gap-3 pt-2"><Button type="submit" disabled={update.isPending}>{update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button><Button type="button" variant="outline" onClick={onLogout}><LogOut className="h-4 w-4" /> Sign out</Button>{msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}</div>
          </form>

          <form onSubmit={onChangePassword} className="space-y-4 rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Change password</h2>
            <div className="space-y-1.5"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            {pwErr ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{pwErr}</p> : null}
            {pwMsg ? <p className="rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-primary">{pwMsg}</p> : null}
            <Button type="submit" disabled={pwBusy || !newPassword}>{pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}</Button>
          </form>
        </div>

        <aside className="space-y-4 rounded-xl border border-border bg-card p-5 text-sm">
          <div>
            <h2 className="font-medium text-foreground">Roles</h2>
            <div className="mt-2 flex flex-wrap gap-1">
              {(myRoles.data ?? []).length === 0 ? <span className="text-xs text-muted-foreground">none</span> : (myRoles.data ?? []).map((r) => (
                <span key={r} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{ROLE_LABELS[r] ?? r}</span>
              ))}
            </div>
          </div>
          <div className="border-t border-border pt-4 text-muted-foreground">
            <h2 className="font-medium text-foreground">Session</h2>
            <p className="mt-2 text-xs">{session ? "Active" : "Inactive"}</p>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
