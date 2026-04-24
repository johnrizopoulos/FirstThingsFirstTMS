import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/contexts/theme";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function SignInPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !name) {
      toast({
        title: "ERROR",
        description: "Email and name are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      // Wait a bit for cookie to be set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Invalidate auth query and refetch to verify session
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      
      // Use window.location for full page reload with new session
      window.location.href = "/";
    } catch (error) {
      toast({
        title: "ERROR",
        description: "Failed to log in. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

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

      <div className="relative z-10 max-w-md mx-auto w-full">
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-3 h-3 bg-primary animate-blink shrink-0" />
            <h1 className="text-xl md:text-3xl font-bold tracking-widest">
              FIRST_THINGS_FIRST
            </h1>
          </div>
          <p className="text-sm md:text-base opacity-70">TASK MANAGEMENT SYSTEM</p>
        </div>

        <div className="border-2 border-primary p-6 md:p-8 bg-card/50 relative">
          {/* Corners */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary" />

          <h2 className="text-lg md:text-xl font-bold mb-4 text-center">_ACCESS_SYSTEM_</h2>
          <p className="text-xs md:text-sm opacity-70 mb-6 text-center">
            Enter your details to continue
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs md:text-sm font-bold mb-2">
                EMAIL_ADDRESS:
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-input border-2 border-primary px-3 py-2 text-sm md:text-base font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="user@example.com"
                required
                disabled={isSubmitting}
                data-testid="input-email"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-xs md:text-sm font-bold mb-2">
                FULL_NAME:
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-input border-2 border-primary px-3 py-2 text-sm md:text-base font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="John Doe"
                required
                disabled={isSubmitting}
                data-testid="input-name"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full border-2 border-primary bg-primary text-primary-foreground px-4 py-3 font-bold text-sm md:text-base hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-submit"
            >
              {isSubmitting ? "[PROCESSING...]" : "[ENTER] ACCESS_SYSTEM"}
            </button>
          </form>

          <p className="mt-6 text-[10px] md:text-xs opacity-50 text-center">
            No password required. Your information is stored securely.
          </p>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-xs md:text-sm opacity-70 hover:opacity-100 transition-opacity underline"
            data-testid="link-back"
          >
            ← BACK
          </a>
        </div>
      </div>
    </div>
  );
}
