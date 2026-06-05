import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMe, updateAccount } from "@/lib/api-creator";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: 0,
  });

  const update = useMutation({
    mutationFn: (patch: { displayName?: string }) => updateAccount(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  const [displayName, setDisplayName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (me.data) setDisplayName(me.data.displayName ?? user?.name ?? "");
    else if (user) setDisplayName(user.name ?? "");
  }, [me.data, user]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await update.mutateAsync({ displayName });
      setMsg("Saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function onLogout() {
    await logout();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <PageContainer>
      <PageHeader title="Account" description="Manage your profile and session." />

      <form
        onSubmit={onSave}
        className="max-w-md space-y-5 rounded-xl border border-border bg-card p-6"
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={me.data?.email ?? user?.email ?? ""} readOnly disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
          {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
        </div>
      </form>
    </PageContainer>
  );
}
