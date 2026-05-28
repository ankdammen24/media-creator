import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2, UserPlus, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

type GateProfile = {
  id: string;
  name: string;
  approval_status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
};

/**
 * Wraps the release wizard. Only users with an approved artist account can
 * submit music. Otherwise they see an application form (no account yet) or a
 * pending/rejected status message.
 */
export function ArtistAccountGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["my-artist-accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artist_profiles")
        .select("id, name, approval_status, rejection_reason")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GateProfile[];
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
        Laddar…
      </div>
    );
  }

  const list = profiles ?? [];
  const hasApproved = list.some((p) => p.approval_status === "approved");
  if (hasApproved) return <>{children}</>;

  const pending = list.find((p) => p.approval_status === "pending");
  const rejected = list.find((p) => p.approval_status === "rejected");

  if (pending) {
    return (
      <StatusCard
        icon={<Clock className="h-6 w-6 text-primary" />}
        title="Din ansökan granskas"
        body={
          <>
            Ditt artistkonto <strong>{pending.name}</strong> väntar på
            godkännande av en administratör. Du kan skicka in musik så snart det
            är godkänt — vi hör av oss.
          </>
        }
      />
    );
  }

  if (rejected) {
    return (
      <ApplicationForm
        rejectedReason={rejected.rejection_reason}
        onApplied={() => qc.invalidateQueries({ queryKey: ["my-artist-accounts", user?.id] })}
      />
    );
  }

  return (
    <ApplicationForm
      onApplied={() => qc.invalidateQueries({ queryKey: ["my-artist-accounts", user?.id] })}
    />
  );
}

function StatusCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          {icon}
        </div>
        <h1 className="mb-2 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function ApplicationForm({
  rejectedReason,
  onApplied,
}: {
  rejectedReason?: string | null;
  onApplied: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("artist_profiles").insert({
      user_id: user.id,
      name: name.trim(),
      bio: bio.trim() || null,
      website_url: website.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
    onApplied();
  }

  if (done) {
    return (
      <StatusCard
        icon={<CheckCircle2 className="h-6 w-6 text-primary" />}
        title="Ansökan skickad"
        body={
          <>
            Tack! Din ansökan om artistkonto har skickats och granskas av en
            administratör. Så snart den är godkänd kan du skicka in musik.
          </>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
          <UserPlus className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Ansök om artistkonto
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            För att skicka in musik behöver du ett artistkonto. Fyll i dina
            uppgifter och ansök — en administratör godkänner kontot innan du kan
            börja skicka in släpp.
          </p>
        </div>
      </div>

      {rejectedReason && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Din tidigare ansökan avslogs: {rejectedReason}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-border bg-card p-5"
      >
        <div>
          <label className="mb-1 block text-xs font-medium">Artistnamn *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Berätta kort om dig/er som artist."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Webbplats / länk</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Skicka ansökan
          </button>
        </div>
      </form>
    </div>
  );
}
