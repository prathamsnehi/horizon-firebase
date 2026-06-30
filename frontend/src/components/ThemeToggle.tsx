import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { currentTheme, toggleTheme } from "../lib/theme";
import { cn } from "../lib/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState(currentTheme());
  return (
    <button
      type="button"
      onClick={() => setMode(toggleTheme())}
      aria-label="Toggle theme"
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      {mode === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
