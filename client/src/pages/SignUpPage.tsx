import { SignUp, useUser } from "@clerk/react";
import { Redirect, Link } from "wouter";
import AppHeader from "@/components/AppHeader";
import { supportMailtoHref } from "@/lib/support";

export default function SignUpPage() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return <Redirect to="/" />;
  }

  return (
    <div
      className="min-h-screen bg-background text-primary font-mono relative overflow-hidden"
      data-testid="page-sign-up"
    >
      <div className="ftf-auth-page-backdrop fixed inset-0 z-0 pointer-events-none" />
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
        <p className="text-xs uppercase tracking-widest text-primary/80 font-mono">
          Need help?{" "}
          <a
            href={supportMailtoHref()}
            className="underline underline-offset-2 hover:text-primary"
            data-testid="link-contact-support-public"
          >
            Contact support
          </a>
        </p>
      </main>
    </div>
  );
}
