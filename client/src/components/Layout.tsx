import React, { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

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
        setLocation("/trash");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setLocation]);

  const NavItem = ({ href, label, hotkey }: { href: string; label: string; hotkey: string }) => {
    const isActive = location === href;
    return (
      <Link href={href}>
        <div
          className={cn(
            "px-4 py-2 font-bold cursor-pointer border border-primary transition-all",
            isActive
              ? "bg-primary text-primary-foreground"
              : "bg-background text-primary hover:bg-secondary"
          )}
        >
          <span className="opacity-50 mr-2">[{hotkey}]</span>
          {label}
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background text-primary font-mono relative overflow-hidden flex flex-col">
      {/* CRT Overlay */}
      <div className="fixed inset-0 crt-overlay pointer-events-none z-50" />

      {/* Header */}
      <header className="border-b border-primary p-4 flex items-center justify-between z-10 bg-background">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary animate-blink" />
          <h1 className="text-xl font-bold tracking-widest">FIRST_THINGS_FIRST_SYS // V.1.0</h1>
        </div>
        <div className="text-xs opacity-70">
          SYSTEM_STATUS: ONLINE | USER: AUTHENTICATED
        </div>
      </header>

      {/* Navigation */}
      <nav className="flex border-b border-primary z-10 bg-background">
        <NavItem href="/" label="FOCUS" hotkey="F1" />
        <NavItem href="/list" label="TASK_LIST" hotkey="F2" />
        <NavItem href="/board" label="MILESTONES" hotkey="F3" />
        <NavItem href="/trash" label="TRASH_BIN" hotkey="F4" />
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto z-0 relative">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-primary p-2 text-xs flex justify-between z-10 bg-background">
        <div>
          CMD: <span className="animate-blink">_</span>
        </div>
        <div className="opacity-50">
          © 2025 FIRST THINGS FIRST CORP.
        </div>
      </footer>
    </div>
  );
}
