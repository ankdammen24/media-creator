import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2 } from "lucide-react";
import { listOwnershipLog } from "@/lib/admin-ownership.functions";

export function AdminOwnershipLog() {
  const fetchLog = useServerFn(listOwnershipLog);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-ownership-log"],
    queryFn: () => fetchLog(),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Logg: ägarbyten</h2>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laddar…
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">
          {error instanceof Error ? error.message : "Kunde inte ladda logg"}
        </p>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga ägarbyten loggade än.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">När</th>
                <th className="py-2 pr-3 font-medium">Artist</th>
                <th className="py-2 pr-3 font-medium">Från → Till</th>
                <th className="py-2 pr-3 font-medium">Av</th>
                <th className="py-2 pr-3 font-medium">Flyttat</th>
                <th className="py-2 pr-3 font-medium">Anledning</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("sv-SE")}
                  </td>
                  <td className="py-2 pr-3 font-medium">{r.artist_name}</td>
                  <td className="py-2 pr-3">
                    {r.from_name} → <span className="font-medium">{r.to_name}</span>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.changed_by_name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {r.affected_albums} alb · {r.affected_submissions} låt · {r.affected_images} bild
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}