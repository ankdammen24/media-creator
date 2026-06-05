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

export const Route = createFileRoute("/_authenticated/account")({ component: AccountPage });

function AccountPage() {
  const { user, session, logout } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: creatorQueryKeys.me, queryFn: getMe, retry: 0 });
  const update = useMutation({ mutationFn: (patch: { displayName?: string }) => updateAccount(patch), onSuccess: () => qc.invalidateQueries({ queryKey: creatorQueryKeys.me }) });
  const [displayName, setDisplayName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setDisplayName(me.data?.displayName ?? user?.name ?? ""); }, [me.data, user]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await update.mutateAsync({ displayName });
      setMsg("Sparat i backend.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Kunde inte spara");
    }
  }

  async function onLogout() {
    await logout();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <PageContainer>
      <PageHeader title="Konto" description="Supabase används endast för autentisering och JWT-session. Profiluppgifter som API:t äger sparas i extern backend." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form onSubmit={onSave} className="space-y-5 rounded-xl border border-border bg-card p-6">
          <div className="space-y-1.5"><Label htmlFor="email">E-post</Label><Input id="email" value={me.data?.email ?? user?.email ?? ""} readOnly disabled /></div>
          <div className="space-y-1.5"><Label htmlFor="name">Visningsnamn</Label><Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ditt namn" /></div>
          <div className="flex flex-wrap items-center gap-3 pt-2"><Button type="submit" disabled={update.isPending}>{update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Spara"}</Button><Button type="button" variant="outline" onClick={onLogout}><LogOut className="h-4 w-4" /> Logga ut</Button>{msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}</div>
        </form>
        <aside className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground"><h2 className="font-medium text-foreground">JWT-forwarding</h2><p className="mt-2">Alla API-anrop skickar Supabase access token som <code>Authorization: Bearer &lt;token&gt;</code>.</p><p className="mt-3">Session: {session ? "aktiv" : "saknas"}</p></aside>
      </div>
    </PageContainer>
  );
}
