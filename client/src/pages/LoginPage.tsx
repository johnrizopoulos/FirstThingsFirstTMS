import { Link } from "wouter";
import { useTheme } from "@/contexts/theme";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-primary font-mono relative overflow-hidden flex flex-col items-center justify-center px-4">
      {/* CRT Overlay */}
      <div className="fixed inset-0 crt-overlay pointer-events-none z-50" />
      {/* Home Button in Top Left */}
      <div className="absolute top-4 left-4 z-20">
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] md:text-xs opacity-70 hover:opacity-100 transition-opacity p-0 h-auto"
            data-testid="button-home"
          >
            [HOME]
          </Button>
        </Link>
      </div>
      {/* Theme Toggle in Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <Button
          onClick={toggleTheme}
          variant="ghost"
          size="sm"
          className="text-[10px] md:text-xs opacity-70 hover:opacity-100 transition-opacity p-0 h-auto flex items-center gap-1"
          data-testid="button-toggle-theme"
          title={`Theme: ${theme} mode`}
        >
          <span>
            {theme === "terminal" ? "█" : theme === "dark" ? <Moon className="w-3 h-3 md:w-4 md:h-4 inline" /> : <Sun className="w-3 h-3 md:w-4 md:h-4 inline" />}
          </span>
          <span className="hidden sm:inline">
            [{theme === "terminal" ? "TERMINAL" : theme === "dark" ? "DARK" : "LIGHT"}]
          </span>
        </Button>
      </div>
      <div className="relative z-10 max-w-2xl mx-auto py-8 text-center w-full">
        <div className="mb-8 md:mb-12">
          <div className="flex items-center justify-center gap-2 mb-4 md:mb-6">
            <div className="w-3 h-3 md:w-4 md:h-4 bg-primary animate-blink shrink-0" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold tracking-wide md:tracking-widest break-words">
              FIRST_THINGS_FIRST
            </h1>
          </div>
          <p className="text-sm md:text-lg opacity-70 mb-2">TASK MANAGEMENT SYSTEM // V.2.1</p>
        </div>

        <Link href="/signin" className="inline-block border-2 border-primary bg-primary text-primary-foreground px-4 py-3 md:px-8 md:py-4 font-bold text-sm md:text-lg hover:bg-primary/80 transition-colors cursor-pointer" data-testid="button-get-authenticated">
          <span className="hidden sm:inline">[ENTER] GET_AUTHENTICATED</span>
          <span className="sm:hidden">GET AUTHENTICATED</span>
        </Link>

        <div className="mt-6 mb-6 md:mb-8 text-sm md:text-base opacity-70 italic max-w-2xl mx-auto text-justify">
          <p>"If you can't focus, you can't create, build, or achieve anything meaningful. The best ideas, the biggest dreams, and even the simplest daily tasks need one thing—your undivided attention."</p>
        </div>

        <div className="border-2 md:border-4 border-primary p-4 md:p-8 mb-6 md:mb-8 bg-card/50 relative">
          {/* Corners */}
          <div className="absolute top-0 left-0 w-3 h-3 md:w-4 md:h-4 border-t-2 border-l-2 md:border-t-4 md:border-l-4 border-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 md:w-4 md:h-4 border-t-2 border-r-2 md:border-t-4 md:border-r-4 border-primary" />
          <div className="absolute bottom-0 left-0 w-3 h-3 md:w-4 md:h-4 border-b-2 border-l-2 md:border-b-4 md:border-l-4 border-primary" />
          <div className="absolute bottom-0 right-0 w-3 h-3 md:w-4 md:h-4 border-b-2 border-r-2 md:border-b-4 md:border-r-4 border-primary" />

          <h2 className="text-lg md:text-2xl font-bold mb-3 md:mb-4">_KEY_FEATURES_</h2>
          <ul className="text-left space-y-2 mb-4 md:mb-6 text-xs md:text-base">
            <li className="flex items-start gap-2">
              <span className="text-primary shrink-0">▸</span>
              <span>Focus mode displays only your highest priority task</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary shrink-0">▸</span>
              <span>Ordered task list view with drag-and-drop prioritization</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary shrink-0">▸</span>
              <span>Board view with Milestones (max 5 active)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary shrink-0">▸</span>
              <span>30-day trash retention with automatic cleanup</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary shrink-0">▸</span>
              <span>Keyboard-driven navigation (F1-F6)</span>
            </li>
          </ul>
        </div>

        <Link href="/signin" className="inline-block border-2 border-primary bg-primary text-primary-foreground px-4 py-3 md:px-8 md:py-4 font-bold text-sm md:text-lg hover:bg-primary/80 transition-colors cursor-pointer" data-testid="button-continue">
          <span className="hidden sm:inline">[ENTER] CONTINUE</span>
          <span className="sm:hidden">CONTINUE</span>
        </Link>

        <div className="mt-6 mb-8 md:mb-12 text-sm md:text-base opacity-70 italic max-w-2xl mx-auto text-justify">
          <p>"Extraordinary success comes from doing ordinary things, with extraordinary focus, over an extraordinary period of time."</p>
          <div className="mt-4 not-italic">
            <p>Application is still in development.</p>
            <p className="mt-1">For support or questions please contact: <span className="font-bold">firstthingsfirsttms@gmail.com</span></p>
          </div>
        </div>

        <div className="mt-8 md:mt-12 text-[10px] md:text-xs opacity-50">
          <p>© 2025 FIRST THINGS FIRST TMS</p>
          <p className="mt-2">DESIGNED FOR MAXIMUM PRODUCTIVITY</p>
          <p className="mt-2">BUILT WITH <a href="https://www.replit.com" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-100">REPLIT</a> BY <a href="https://www.johnrizopoulos.com" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-100">JOHN RIZOPOULOS</a></p>
        </div>
      </div>
    </div>
  );
}
