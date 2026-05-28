import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Returns whether the current user has elevated editor privileges
 * (admin or artist role). These users can edit any artist profile,
 * album, image and submission — not just the ones they own.
 */
export function useEditorRole() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["editor-role", user?.id ?? null],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return { isAdmin: false, isArtist: false };
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "artist"]);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role);
      return {
        isAdmin: roles.includes("admin"),
        isArtist: roles.includes("artist"),
      };
    },
  });
  const isAdmin = !!data?.isAdmin;
  const isArtist = !!data?.isArtist;
  return { isAdmin, isArtist, isEditor: isAdmin || isArtist };
}