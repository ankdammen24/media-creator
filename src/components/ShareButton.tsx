import { useState } from "react";
import { Share2, Link as LinkIcon, Mail, Check, Facebook, Twitter, Linkedin, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buildShareIntents, absoluteUrl, type ShareData } from "@/lib/share";
import { cn } from "@/lib/utils";

type Props = {
  path: string;
  title: string;
  text?: string;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
  label?: string;
};

export function ShareButton({
  path,
  title,
  text,
  variant = "outline",
  size = "sm",
  label = "Dela",
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = absoluteUrl(path);
  const data: ShareData = { url, title, text };
  const intents = buildShareIntents(data);

  const triggerClass = cn(
    "inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors",
    size === "sm" ? "px-3 py-2" : "px-4 py-2 text-sm",
    variant === "primary" &&
      "bg-primary text-primary-foreground hover:bg-primary/90",
    variant === "outline" && "border border-border hover:bg-accent",
    variant === "ghost" && "hover:bg-accent",
  );

  const handleNative = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return true;
      } catch {
        /* user cancelled or unsupported */
      }
    }
    return false;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Länk kopierad");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Kunde inte kopiera länk");
    }
  };

  const onTriggerClick = async (e: React.MouseEvent) => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      e.preventDefault();
      const ok = await handleNative();
      if (!ok) setOpen(true);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClass} onClick={onTriggerClick}>
          <Share2 className="h-3.5 w-3.5" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Dela
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
        >
          {copied ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <LinkIcon className="h-4 w-4" />
          )}
          {copied ? "Kopierat!" : "Kopiera länk"}
        </button>
        <div className="my-1 h-px bg-border" />
        <ShareLink href={intents.facebook} icon={<Facebook className="h-4 w-4" />} label="Facebook" />
        <ShareLink href={intents.twitter} icon={<Twitter className="h-4 w-4" />} label="X (Twitter)" />
        <ShareLink href={intents.linkedin} icon={<Linkedin className="h-4 w-4" />} label="LinkedIn" />
        <ShareLink href={intents.whatsapp} icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" />
        <ShareLink href={intents.telegram} icon={<Send className="h-4 w-4" />} label="Telegram" />
        <ShareLink href={intents.email} icon={<Mail className="h-4 w-4" />} label="E-post" newTab={false} />
      </PopoverContent>
    </Popover>
  );
}

function ShareLink({
  href,
  icon,
  label,
  newTab = true,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  newTab?: boolean;
}) {
  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
    >
      {icon}
      {label}
    </a>
  );
}