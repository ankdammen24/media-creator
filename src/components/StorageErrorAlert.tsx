import { AlertTriangle } from "lucide-react";

function isRlsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("row-level security") ||
    m.includes("row level security") ||
    m.includes("violates row-level") ||
    m.includes("rls") ||
    m.includes("unauthorized") ||
    m.includes("not authorized") ||
    m.includes("permission denied") ||
    m.includes("new row violates")
  );
}

export function StorageErrorAlert({ message }: { message: string }) {
  const rls = isRlsError(message);
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-2">
          <p className="font-medium">
            {rls
              ? "Uppladdningen blockerades av behörighetsregler"
              : "Uppladdningen misslyckades"}
          </p>
          <p className="opacity-90">{message}</p>
          {rls && (
            <div className="space-y-1">
              <p className="font-medium">Kontrollera följande:</p>
              <ul className="list-disc space-y-0.5 pl-4 opacity-90">
                <li>Att du är inloggad (logga ut och in igen om sessionen är gammal).</li>
                <li>Att du redigerar din egen artistprofil – du kan bara ladda upp till artister du äger.</li>
                <li>Att filen är JPG, PNG eller WEBP och inom storleksgränsen.</li>
                <li>Att du har behörighet (artistroll eller admin) i denna katalog.</li>
              </ul>
              <p className="opacity-90">
                Kvarstår felet, prova att ladda om sidan eller kontakta en administratör.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}