import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw redirect({ to: "/login" });

    // Disabled-user check
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_disabled")
      .eq("user_id", data.session.user.id)
      .maybeSingle();
    if (profile?.is_disabled) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }

    return { user: data.session.user };
  },
  component: AppShell,
});
