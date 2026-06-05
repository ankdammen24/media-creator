import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AppRole = "super_admin" | "admin" | "creator" | "artist";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  creator: "Creator",
  artist: "Artist",
};

export function useMyRoles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
    staleTime: 60_000,
  });
}

export function hasAnyRole(roles: AppRole[] | undefined, needed: AppRole[]): boolean {
  if (!roles) return false;
  return needed.some((r) => roles.includes(r));
}
