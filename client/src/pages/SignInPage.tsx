import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Redirect, useLocation, Link } from "wouter";
import { useSignIn, useUser } from "@clerk/react";
import { useTheme } from "@/contexts/theme";
import { backdropUrlFor } from "@/lib/clerkAppearance";
import AppHeader from "@/components/AppHeader";
import {
  SUPPORT_EMAIL,
  describeError,
  detectRateLimit,
  formatCountdown,
} from "@/lib/clerkRateLimit";

export default function SignInPage() {
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const { signIn, fetchStatus } = useSignIn();
  const { theme } = useTheme();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldownUntil === null) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    setNow(Date.now());
    tickRef.current = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownUntil) {
        setCooldownUntil(null);
      }
    }, 1000);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [cooldownUntil]);

  const cooldownActive = cooldownUntil !== null && cooldownUntil > now;
  const cooldownSecondsRemaining = cooldownActive
    ? Math.ceil((cooldownUntil! - now) / 1000)
    : 0;

  const cooldownNotice = useMemo(() => {
    if (!cooldownActive) return "";
    return `Too many attempts. Try again in ${formatCountdown(cooldownSecondsRemaining)}.`;
  }, [cooldownActive, cooldownSecondsRemaining]);

  const handleErrorResult = (error: unknown): boolean => {
    const { limited, retryAfterSeconds } = detectRateLimit(error);
    if (limited) {
      const until = Date.now() + retryAfterSeconds * 1000;
      setCooldownUntil(until);
      setErrorMessage("");
      return true;
    }
    setErrorMessage(describeError(error));
    return false;
  };

  if (userLoaded && isSignedIn) {
    return <Redirect to="/" />;
  }

  const backdropUrl = backdropUrlFor(theme);
  const isBusy = fetchStatus === "fetching";
  const inputsLocked = isBusy || cooldownActive;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cooldownActive) return;
    setErrorMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Enter the email tied to your account.");
      return;
    }
    if (!password) {
      setErrorMessage("Enter your password.");
      return;
    }

    const passwordResult = await signIn.password({
      identifier: trimmedEmail,
      password,
    });
    if (passwordResult.error) {
      handleErrorResult(passwordResult.error);
      return;
    }

    const finalizeResult = await signIn.finalize({
      navigate: () => {
        setLocation("/");
        return Promise.resolve();
      },
    });
    if (finalizeResult.error) {
      handleErrorResult(finalizeResult.error);
      return;
    }

    setLocation("/");
  };

  const renderCooldownBanner = () =>
    cooldownActive ? (
      <div
        className="border-2 border-destructive bg-destructive/10 p-3 space-y-2"
        role="alert"
        data-testid="banner-sign-in-cooldown"
      >
        <p
          className="text-sm font-bold uppercase tracking-wider text-destructive"
          data-testid="text-sign-in-cooldown-message"
        >
          {cooldownNotice}
        </p>
        <p className="text-xs text-foreground/80">
          We've paused new sign-in attempts to keep your account safe. You can
          wait it out, try{" "}
          <Link
            href="/reset-password"
            className="underline text-primary hover:text-primary/80"
            data-testid="link-cooldown-reset-password"
          >
            resetting your password
          </Link>
          , or{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Sign-in%20locked%20out`}
            className="underline text-primary hover:text-primary/80"
            data-testid="link-cooldown-support"
          >
            contact support
          </a>{" "}
          for help.
        </p>
      </div>
    ) : null;

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
      <AppHeader />
      <div className="fixed inset-0 crt-overlay pointer-events-none z-50" />
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-24 gap-4">
        <div className="w-full max-w-md border-2 border-primary bg-background/95 p-6 md:p-8 shadow-none">
          <header className="mb-6">
            <h1
              className="text-xl md:text-2xl font-bold uppercase tracking-widest text-primary"
              data-testid="text-sign-in-title"
            >
              [SIGN IN]
            </h1>
            <p className="mt-2 text-sm text-foreground/70">
              Welcome back. Enter your credentials to resume your session.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-sign-in">
            <div>
              <label
                htmlFor="sign-in-email"
                className="block text-xs uppercase tracking-wider text-primary mb-1"
              >
                Email
              </label>
              <input
                id="sign-in-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-none border-2 border-primary bg-input text-foreground px-3 py-2 font-mono focus:outline-none focus:ring-0"
                data-testid="input-sign-in-email"
              />
            </div>

            <div>
              <label
                htmlFor="sign-in-password"
                className="block text-xs uppercase tracking-wider text-primary mb-1"
              >
                Password
              </label>
              <input
                id="sign-in-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-none border-2 border-primary bg-input text-foreground px-3 py-2 font-mono focus:outline-none focus:ring-0"
                data-testid="input-sign-in-password"
              />
            </div>

            {renderCooldownBanner()}

            {errorMessage && !cooldownActive && (
              <p
                className="text-sm text-destructive font-mono"
                data-testid="text-sign-in-error"
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={inputsLocked}
              className="w-full border-2 border-primary bg-primary text-primary-foreground px-4 py-2 font-bold uppercase tracking-widest hover:bg-primary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="button-sign-in-submit"
            >
              {cooldownActive
                ? `[WAIT ${formatCountdown(cooldownSecondsRemaining)}]`
                : isBusy
                ? "[SIGNING IN…]"
                : "[SIGN IN]"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t-2 border-primary/40 flex flex-col items-center gap-2 text-center text-xs uppercase tracking-wider">
            <Link
              href="/reset-password"
              className="text-primary underline hover:text-primary/80"
              data-testid="link-forgot-password"
            >
              Forgot password?
            </Link>
            <Link
              href="/sign-up"
              className="text-primary underline hover:text-primary/80"
              data-testid="link-sign-up"
            >
              Need an account? Sign up
            </Link>
          </div>
        </div>
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
