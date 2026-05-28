import {
  FileText,
  UploadCloud,
  Clock,
  CheckCircle2,
  XCircle,
  Globe,
} from "lucide-react";

export type ReleaseStatus =
  | "draft"
  | "uploaded"
  | "under_review"
  | "approved"
  | "rejected"
  | "published";

const CONFIG: Record<
  ReleaseStatus,
  { label: string; icon: typeof FileText; tone: string }
> = {
  draft: {
    label: "Draft",
    icon: FileText,
    tone: "border-border bg-muted/40 text-muted-foreground",
  },
  uploaded: {
    label: "Uploaded",
    icon: UploadCloud,
    tone: "border-primary/30 bg-primary/10 text-primary",
  },
  under_review: {
    label: "Under review",
    icon: Clock,
    tone: "border-accent/40 bg-accent/15 text-accent-foreground",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    tone: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  published: {
    label: "Published",
    icon: Globe,
    tone: "border-primary/40 bg-gradient-to-r from-primary/20 to-accent/20 text-foreground",
  },
};

export function ReleaseStatusBadge({
  status,
  size = "sm",
}: {
  status: ReleaseStatus;
  size?: "sm" | "md";
}) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;
  const sizing =
    size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizing} ${cfg.tone}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}