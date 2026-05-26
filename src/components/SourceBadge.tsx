import { Radio, Disc3 } from "lucide-react";

export function SourceBadge({ source }: { source?: string }) {
  const isAzura = source?.toLowerCase() === "azuracast";
  const label = isAzura ? "AzuraCast" : "Media Catalog";
  const Icon = isAzura ? Radio : Disc3;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        isAzura
          ? "bg-accent/15 text-accent border border-accent/30"
          : "bg-primary/15 text-primary border border-primary/30"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}