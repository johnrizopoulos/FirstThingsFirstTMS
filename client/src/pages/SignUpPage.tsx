import { SignUp, useUser } from "@clerk/react";
import { Redirect, Link } from "wouter";
import { useTheme } from "@/contexts/theme";
import { backdropUrlFor } from "@/lib/clerkAppearance";
import AppHeader from "@/components/AppHeader";

export default function SignUpPage() {
  const { isSignedIn } = useUser();
  const { theme } = useTheme();

  if (isSignedIn) {
    return <Redirect to="/" />;
  }

  const backdropUrl = backdropUrlFor(theme);

  return (
    <div
      className="min-h-screen bg-background text-primary font-mono relative overflow-hidden"
      data-testid="page-sign-up"
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
      <AppHeader />
      <div className="fixed inset-0 crt-overlay pointer-events-none z-50" />
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-24 gap-4">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          forceRedirectUrl="/"
        />
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
