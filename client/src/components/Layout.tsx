import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/contexts/theme";
import { UserButton } from "@clerk/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu, Moon, Sun, X } from "lucide-react";
import { supportMailtoHref } from "@/lib/support";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const IOS_HINT_DISMISSED_KEY = "ftf:ios-install-hint-dismissed";

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Mac") && "ontouchend" in document);
  const isStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIos && !isStandalone;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function Layout({ children, mobileHeaderContent }: { children: React.ReactNode; mobileHeaderContent?: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setLocation("/");
      } else if (e.key === "F2") {
        e.preventDefault();
        setLocation("/list");
      } else if (e.key === "F3") {
        e.preventDefault();
        setLocation("/board");
      } else if (e.key === "F4") {
        e.preventDefault();
        setLocation("/completed");
      } else if (e.key === "F5") {
        e.preventDefault();
        setLocation("/trash");
      } else if (e.key === "F6") {
        e.preventDefault();
        setLocation("/tutorial");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setLocation]);

  useEffect(() => {
    if (isStandaloneDisplay()) return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setInstallEvent(null);

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    if (isIosSafari()) {
      try {
        const dismissed = localStorage.getItem(IOS_HINT_DISMISSED_KEY) === "1";
        if (!dismissed) setShowIosHint(true);
      } catch {
        setShowIosHint(true);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } finally {
      setInstallEvent(null);
    }
  };

  const dismissIosHint = () => {
    setShowIosHint(false);
    try {
      localStorage.setItem(IOS_HINT_DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const NavItem = ({ href, label, hotkey }: { href: string; label: string; hotkey: string }) => {
    const isActive = location === href;
    return (
      <Link href={href}>
        <div
          className={cn(
            "px-4 py-2 font-bold cursor-pointer border border-primary transition-all whitespace-nowrap",
            isActive
              ? "bg-primary text-primary-foreground"
              : "bg-background text-primary hover:bg-secondary"
          )}
          data-testid={`nav-${label.toLowerCase()}`}
        >
          <span className="opacity-50 mr-2">[{hotkey}]</span>
          {label}
        </div>
      </Link>
    );
  };

  const MobileNavItem = ({ href, label, hotkey }: { href: string; label: string; hotkey: string }) => {
    const isActive = location === href;
    return (
      <Link href={href} className={cn(
        "w-full flex items-center px-2 py-2 cursor-pointer hover:bg-primary/10",
        isActive && "bg-primary/20 font-bold"
      )}>
        <span className="opacity-50 mr-2 w-8">[{hotkey}]</span>
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background text-primary font-mono relative overflow-hidden flex flex-col safe-pad-x">
      {/* CRT Overlay */}
      <div className="fixed inset-0 crt-overlay pointer-events-none z-50" />

      {/* Header */}
      <header className="border-b border-primary p-4 flex items-center justify-between z-10 bg-background safe-pad-top">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-3 h-3 bg-primary animate-blink shrink-0" />
          <h1 className="text-sm md:text-xl font-bold tracking-widest truncate">FIRST_THINGS_FIRST_TMS</h1>
        </div>
        <div className="flex items-center gap-2 ml-2">
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
          <UserButton />
        </div>
      </header>

      {/* Navigation */}
      {isMobile ? (
        <div className="border-b border-primary p-2 z-10 bg-background flex justify-between items-center gap-2">
           {mobileHeaderContent ? (
             <div className="flex-1">{mobileHeaderContent}</div>
           ) : (
             <div className="text-xs font-bold px-2">
               CURRENT_VIEW: {location === "/" ? "FOCUS" : location === "/tutorial" ? "TUTORIAL" : location.substring(1).toUpperCase()}
             </div>
           )}
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-primary text-primary rounded-none h-8 w-8 p-0 shrink-0" data-testid="button-mobile-menu">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-background border-2 border-primary text-foreground font-mono rounded-none p-0">
              <DropdownMenuItem asChild className="focus:bg-primary focus:text-primary-foreground rounded-none p-0">
                <MobileNavItem href="/" label="FOCUS" hotkey="F1" />
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-primary focus:text-primary-foreground rounded-none p-0">
                <MobileNavItem href="/list" label="LIST" hotkey="F2" />
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-primary focus:text-primary-foreground rounded-none p-0">
                <MobileNavItem href="/board" label="BOARD" hotkey="F3" />
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-primary focus:text-primary-foreground rounded-none p-0">
                <MobileNavItem href="/completed" label="COMPLETED" hotkey="F4" />
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-primary focus:text-primary-foreground rounded-none p-0">
                <MobileNavItem href="/trash" label="TRASH" hotkey="F5" />
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-primary focus:text-primary-foreground rounded-none p-0">
                <MobileNavItem href="/tutorial" label="TUTORIAL" hotkey="F6" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <nav className="flex border-b border-primary z-10 bg-background overflow-x-auto scrollbar-hide">
          <NavItem href="/" label="FOCUS" hotkey="F1" />
          <NavItem href="/list" label="LIST" hotkey="F2" />
          <NavItem href="/board" label="BOARD" hotkey="F3" />
          <NavItem href="/completed" label="COMPLETED" hotkey="F4" />
          <NavItem href="/trash" label="TRASH" hotkey="F5" />
          <NavItem href="/tutorial" label="TUTORIAL" hotkey="F6" />
        </nav>
      )}

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto z-0 relative">
        {children}
      </main>

      {showIosHint && (
        <div
          className="border-t border-primary bg-background text-primary text-xs px-3 py-2 flex items-center justify-between gap-2 z-10"
          data-testid="banner-ios-install-hint"
        >
          <span className="font-bold tracking-wider">
            TAP SHARE → ADD TO HOME SCREEN
          </span>
          <button
            type="button"
            onClick={dismissIosHint}
            className="opacity-70 hover:opacity-100"
            aria-label="Dismiss install hint"
            data-testid="button-dismiss-ios-hint"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-primary p-2 text-xs flex justify-between items-center gap-2 z-10 bg-background safe-pad-bottom">
        <div className="flex items-center gap-2">
          <span>CMD: <span className="animate-blink">_</span></span>
          {installEvent && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="border border-primary px-2 py-0.5 font-bold tracking-wider hover:bg-primary hover:text-primary-foreground transition-colors"
              data-testid="button-install-app"
            >
              [INSTALL_APP]
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={supportMailtoHref()}
            className="opacity-70 hover:opacity-100 underline underline-offset-2 transition-opacity"
            data-testid="link-contact-support"
          >
            CONTACT_SUPPORT
          </a>
          <span className="opacity-50">
            © 2025 FIRST THINGS FIRST CORP.
          </span>
        </div>
      </footer>
    </div>
  );
}
