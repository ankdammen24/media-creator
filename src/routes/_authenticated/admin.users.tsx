import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { hasAnyRole, ROLE_LABELS, useMyRoles, type AppRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: AdminUsersPage });

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  is_disabled: boolean;
  created_at: string;
};

type RoleRow = { user_id: string; role: AppRole };

const ASSIGNABLE_ROLES: AppRole[] = ["super_admin", "admin", "creator", "artist"];

function AdminUsersPage() {
  const qc = useQueryClient();
  const myRoles = useMyRoles();
  const isAdmin = hasAnyRole(myRoles.data, ["admin", "super_admin"]);
  const isSuperAdmin = hasAnyRole(myRoles.data, ["super_admin"]);

  const profiles = useQuery({
    enabled: isAdmin,
    queryKey: ["admin", "profiles"],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, is_disabled, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const roles = useQuery({
    enabled: isAdmin,
    queryKey: ["admin", "user_roles"],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const setRole = useMutation({
    mutationFn: async (vars: { user_id: string; role: AppRole }) => {
      const { error } = await supabase.rpc("admin_set_user_role", {
        _target_user: vars.user_id,
        _new_role: vars.role,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "user_roles"] }),
  });

  const setDisabled = useMutation({
    mutationFn: async (vars: { user_id: string; disabled: boolean }) => {
      const { error } = await supabase.rpc("admin_set_user_disabled", {
        _target_user: vars.user_id,
        _disabled: vars.disabled,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "profiles"] }),
  });

  if (myRoles.isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const rolesByUser = new Map<string, AppRole[]>();
  for (const r of roles.data ?? []) {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role);
    rolesByUser.set(r.user_id, arr);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        description={isSuperAdmin ? "Manage roles and access for all users." : "View users. Only super admins can change roles."}
      />
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(profiles.data ?? []).map((p) => {
              const userRoles = rolesByUser.get(p.user_id) ?? [];
              const primary = userRoles[0] ?? "creator";
              return (
                <tr key={p.user_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{p.display_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.user_id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {userRoles.length === 0 ? <span className="text-xs text-muted-foreground">none</span> : userRoles.map((r) => (
                        <span key={r} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{ROLE_LABELS[r] ?? r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.is_disabled ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Disabled</span> : <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Active</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {isSuperAdmin ? (
                        <>
                          <select
                            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                            value={primary}
                            disabled={setRole.isPending}
                            onChange={(e) => setRole.mutate({ user_id: p.user_id, role: e.target.value as AppRole })}
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            variant={p.is_disabled ? "default" : "outline"}
                            disabled={setDisabled.isPending}
                            onClick={() => setDisabled.mutate({ user_id: p.user_id, disabled: !p.is_disabled })}
                          >
                            {p.is_disabled ? "Enable" : "Disable"}
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">view only</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {(profiles.data?.length ?? 0) === 0 && !profiles.isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">No users.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
