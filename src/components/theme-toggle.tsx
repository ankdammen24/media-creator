import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";

const order: Theme[] = ["light", "dark", "system"];
const labels: Record<Theme, string> = {
  light: "Ljust tema",
  dark: "Mörkt tema",
  system: "Följer systemet",
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const next = order[(order.indexOf(theme) + 1) % order.length];
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`${labels[theme]} — klicka för ${labels[next].toLowerCase()}`}
      aria-label={`${labels[theme]}. Byt till ${labels[next].toLowerCase()}.`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground ${className}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}