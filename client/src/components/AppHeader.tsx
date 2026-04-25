import type { ReactNode } from "react";
import { Link } from "wouter";
import { useTheme } from "@/contexts/theme";

interface AppHeaderProps {
  leftSlot?: ReactNode;
}

export default function AppHeader({ leftSlot }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <div className="fixed top-4 left-4 z-40 flex gap-2">
        {leftSlot ?? (
          <Link
            href="/"
            className="flex items-center gap-2 border-2 border-primary bg-background text-primary px-4 py-2 font-bold text-xs md:text-sm hover:bg-primary hover:text-primary-foreground transition-colors tracking-widest"
            data-testid="link-home-wordmark"
          >
            <span className="w-2 h-2 bg-primary animate-blink" />
            FIRST_THINGS_FIRST
          </Link>
        )}
      </div>
      <div className="fixed top-4 right-4 z-40">
        <button
          onClick={toggleTheme}
          className="border-2 border-primary bg-background text-primary px-4 py-2 font-bold text-xs md:text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
          title="Change theme"
          data-testid="button-theme-toggle"
        >
          [{theme.toUpperCase()}]
        </button>
      </div>
    </>
  );
}
