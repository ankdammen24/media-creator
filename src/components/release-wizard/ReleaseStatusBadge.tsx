import {
  FileText,
  UploadCloud,
  Clock,
  CheckCircle2,
  XCircle,
  Globe,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export type ReleaseStatus =
  | "draft"
  | "uploaded"
  | "under_review"
  | "approved"
  | "rejected"
  | "published";

const CONFIG: Record<
  ReleaseStatus,
  { icon: typeof FileText; tone: string }
> = {
  draft: {
    icon: FileText,
    tone: "border-border bg-muted/40 text-muted-foreground",
  },
  uploaded: {
    icon: UploadCloud,
    tone: "border-primary/30 bg-primary/10 text-primary",
  },
  under_review: {
    icon: Clock,
    tone: "border-accent/40 bg-accent/15 text-accent-foreground",
  },
  approved: {
    icon: CheckCircle2,
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  },
  rejected: {
    icon: XCircle,
    tone: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  published: {
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
  const { t } = useTranslation();
  const cfg = CONFIG[status];
  const Icon = cfg.icon;
  const sizing =
    size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizing} ${cfg.tone}`}
    >
      <Icon className="h-3 w-3" />
      {t(`releaseStatus.${status}`)}
    </span>
  );
}