import { SignIn, useUser } from "@clerk/react";
import { Redirect, Link } from "wouter";
import { useTheme } from "@/contexts/theme";
import { backdropUrlFor } from "@/lib/clerkAppearance";

export default function SignInPage() {
  const { isSignedIn } = useUser();
  const { theme, toggleTheme } = useTheme();

  if (isSignedIn) {
    return <Redirect to="/" />;
  }

  const backdropUrl = backdropUrlFor(theme);

  return (
    <div
      className="min-h-screen bg-background text-primary font-mono relative overflow-hidden"
      data-testid="page-sign-in"
    >
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--background) / 0.65), hsl(var(--background) / 0.65)), url("${backdropUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="fixed top-4 left-4 z-40">
        <Link
          href="/"
          className="flex items-center gap-2 border-2 border-primary bg-background text-primary px-4 py-2 font-bold text-xs md:text-sm hover:bg-primary hover:text-primary-foreground transition-colors tracking-widest"
          data-testid="link-home-wordmark"
        >
          <span className="w-2 h-2 bg-primary animate-blink" />
          FIRST_THINGS_FIRST
        </Link>
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
      <div className="fixed inset-0 crt-overlay pointer-events-none z-50" />
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-24 gap-4">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/"
        />
        <Link
          href="/reset-password"
          className="text-xs uppercase tracking-widest text-primary underline hover:text-primary/80 font-mono"
          data-testid="link-forgot-password"
        >
          Forgot password?
        </Link>
        <Link
          href="/"
          className="text-xs uppercase tracking-widest text-primary underline hover:text-primary/80 font-mono"
          data-testid="link-back-home"
        >
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
