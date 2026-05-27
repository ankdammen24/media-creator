import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Soundloom Core" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <NotificationsPage />
    </ProtectedRoute>
  ),
});

type Row = {
  id: string;
  type: string;
  title: string;
  body: string;
  language: string;
  read_at: string | null;
  email_status: string;
  created_at: string;
  submission_id: string | null;
};

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("notifications" as never)
        .select(
          "id, type, title, body, language, read_at, email_status, created_at, submission_id",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from("notifications" as never)
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread"] });
  }

  async function markOne(id: string) {
    await supabase
      .from("notifications" as never)
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread"] });
  }

  const unread = (data ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "All caught up."}
            </p>
          </div>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        <ul className="space-y-3">
          {data!.map((n) => {
            const approved = n.type === "submission_approved";
            return (
              <li
                key={n.id}
                className={`rounded-xl border p-4 ${
                  n.read_at
                    ? "border-border bg-card"
                    : "border-primary/30 bg-primary/5"
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {approved ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <XCircle className="h-3 w-3 text-destructive" />
                  )}
                  <span>{approved ? "Approved" : "Needs changes"}</span>
                  <span>·</span>
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                  <span>·</span>
                  <span>email: {n.email_status}</span>
                </div>
                <h2 className="text-sm font-semibold">{n.title}</h2>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                  {n.body}
                </pre>
                {!n.read_at && (
                  <button
                    onClick={() => markOne(n.id)}
                    className="mt-3 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-secondary"
                  >
                    Mark read
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}