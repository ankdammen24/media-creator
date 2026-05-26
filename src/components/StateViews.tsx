import { AlertCircle, Music2, Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-card/50 px-6 py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" />
      <p className="text-sm text-destructive">{msg}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/30 px-6 py-16 text-center">
      <div className="rounded-full bg-secondary p-3">
        <Music2 className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="aspect-square w-full animate-pulse rounded-md bg-secondary" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
    </div>
  );
}