import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Redirect, useLocation, Link } from "wouter";
import { useSignIn, useUser } from "@clerk/react";
import { useTheme } from "@/contexts/theme";
import AppHeader from "@/components/AppHeader";
import { backdropUrlFor } from "@/lib/clerkAppearance";
import {
  clearCooldown,
  describeError,
  detectRateLimit,
  formatCountdown,
  loadActiveCooldown,
  loadCooldown,
  persistCooldown,
} from "@/lib/clerkRateLimit";
import { supportMailtoHref } from "@/lib/support";

type Step = "request" | "verify";

export default function ResetPasswordPage() {
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const { signIn, fetchStatus } = useSignIn();
  const { theme } = useTheme();
  const [, setLocation] = useLocation();

  const initialActive = useMemo(() => loadActiveCooldown("reset-password"), []);
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState(() => initialActive?.identifier ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(
    () => initialActive?.until ?? null,
  );
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
        clearCooldown("reset-password", email);
      }
    }, 1000);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [cooldownUntil, email]);

  useEffect(() => {
    const restored = loadCooldown("reset-password", email);
    setCooldownUntil(restored);
  }, [email]);

  const cooldownActive = cooldownUntil !== null && cooldownUntil > now;
  const cooldownSecondsRemaining = cooldownActive ? Math.ceil((cooldownUntil! - now) / 1000) : 0;

  const cooldownNotice = useMemo(() => {
    if (!cooldownActive) return "";
    return `Too many attempts. Try again in ${formatCountdown(cooldownSecondsRemaining)}.`;
  }, [cooldownActive, cooldownSecondsRemaining]);

  const handleErrorResult = (error: unknown): boolean => {
    const { limited, retryAfterSeconds } = detectRateLimit(error);
    if (limited) {
      const until = Date.now() + retryAfterSeconds * 1000;
      setCooldownUntil(until);
      persistCooldown("reset-password", email, until);
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

  const handleRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cooldownActive) return;
    setErrorMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Enter the email address tied to your account.");
      return;
    }

    const createResult = await signIn.create({ identifier: trimmedEmail });
    if (createResult.error) {
      handleErrorResult(createResult.error);
      return;
    }

    const sendResult = await signIn.resetPasswordEmailCode.sendCode();
    if (sendResult.error) {
      handleErrorResult(sendResult.error);
      return;
    }

    setStep("verify");
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cooldownActive) return;
    setErrorMessage("");

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setErrorMessage("Enter the 6-digit code we just emailed you.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("New password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match. Re-enter and try again.");
      return;
    }

    const verifyResult = await signIn.resetPasswordEmailCode.verifyCode({ code: trimmedCode });
    if (verifyResult.error) {
      handleErrorResult(verifyResult.error);
      return;
    }

    const submitResult = await signIn.resetPasswordEmailCode.submitPassword({ password });
    if (submitResult.error) {
      handleErrorResult(submitResult.error);
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

  const handleResendCode = async () => {
    if (cooldownActive) return;
    setErrorMessage("");
    const sendResult = await signIn.resetPasswordEmailCode.sendCode();
    if (sendResult.error) {
      handleErrorResult(sendResult.error);
    }
  };

  const handleStartOver = async () => {
    if (cooldownActive) return;
    setErrorMessage("");
    setCode("");
    setPassword("");
    setConfirmPassword("");
    const resetResult = await signIn.reset();
    if (resetResult.error) {
      handleErrorResult(resetResult.error);
      return;
    }
    setStep("request");
  };

  const renderCooldownBanner = () =>
    cooldownActive ? (
      <div
        className="border-2 border-destructive bg-destructive/10 p-3 space-y-2"
        role="alert"
        data-testid="banner-reset-cooldown"
      >
        <p
          className="text-sm font-bold uppercase tracking-wider text-destructive"
          data-testid="text-reset-cooldown-message"
        >
          {cooldownNotice}
        </p>
        <p className="text-xs text-foreground/80">
          We've paused new attempts to keep your account safe. You can wait it out, head{" "}
          <Link
            href="/sign-in"
            className="underline text-primary hover:text-primary/80"
            data-testid="link-cooldown-sign-in"
          >
            back to sign in
          </Link>
          , or{" "}
          <a
            href={supportMailtoHref("Password reset locked out")}
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
      data-testid="page-reset-password"
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
              data-testid="text-reset-password-title"
            >
              [RESET PASSWORD]
            </h1>
            <p className="mt-2 text-sm text-foreground/70">
              {step === "request" &&
                "Enter your account email and we'll send you a one-time recovery code."}
              {step === "verify" &&
                "Check your email for the 6-digit code, then choose a new password."}
            </p>
          </header>

          {step === "request" && (
            <form onSubmit={handleRequest} className="space-y-4" data-testid="form-reset-request">
              <div>
                <label
                  htmlFor="reset-email"
                  className="block text-xs uppercase tracking-wider text-primary mb-1"
                >
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-none border-2 border-primary bg-input text-foreground px-3 py-2 font-mono focus:outline-none focus:ring-0"
                  data-testid="input-reset-email"
                />
              </div>

              {renderCooldownBanner()}

              {errorMessage && !cooldownActive && (
                <p
                  className="text-sm text-destructive font-mono"
                  data-testid="text-reset-error"
                >
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={inputsLocked}
                className="w-full border-2 border-primary bg-primary text-primary-foreground px-4 py-2 font-bold uppercase tracking-widest hover:bg-primary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="button-send-reset-code"
              >
                {cooldownActive
                  ? `[WAIT ${formatCountdown(cooldownSecondsRemaining)}]`
                  : isBusy
                  ? "[SENDING…]"
                  : "[SEND RECOVERY CODE]"}
              </button>
            </form>
          )}

          {step === "verify" && (
            <form onSubmit={handleVerify} className="space-y-4" data-testid="form-reset-verify">
              <div>
                <label
                  htmlFor="reset-code"
                  className="block text-xs uppercase tracking-wider text-primary mb-1"
                >
                  Recovery code
                </label>
                <input
                  id="reset-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="w-full rounded-none border-2 border-primary bg-input text-foreground px-3 py-2 font-mono tracking-widest focus:outline-none focus:ring-0"
                  data-testid="input-reset-code"
                />
              </div>

              <div>
                <label
                  htmlFor="reset-new-password"
                  className="block text-xs uppercase tracking-wider text-primary mb-1"
                >
                  New password
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-none border-2 border-primary bg-input text-foreground px-3 py-2 font-mono focus:outline-none focus:ring-0"
                  data-testid="input-reset-new-password"
                />
              </div>

              <div>
                <label
                  htmlFor="reset-confirm-password"
                  className="block text-xs uppercase tracking-wider text-primary mb-1"
                >
                  Confirm new password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-none border-2 border-primary bg-input text-foreground px-3 py-2 font-mono focus:outline-none focus:ring-0"
                  data-testid="input-reset-confirm-password"
                />
              </div>

              {renderCooldownBanner()}

              {errorMessage && !cooldownActive && (
                <p
                  className="text-sm text-destructive font-mono"
                  data-testid="text-reset-error"
                >
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={inputsLocked}
                className="w-full border-2 border-primary bg-primary text-primary-foreground px-4 py-2 font-bold uppercase tracking-widest hover:bg-primary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="button-submit-new-password"
              >
                {cooldownActive
                  ? `[WAIT ${formatCountdown(cooldownSecondsRemaining)}]`
                  : isBusy
                  ? "[UPDATING…]"
                  : "[UPDATE PASSWORD]"}
              </button>

              <div className="flex items-center justify-between text-xs uppercase tracking-wider">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={inputsLocked}
                  className="text-primary underline hover:text-primary/80 disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
                  data-testid="button-resend-reset-code"
                >
                  {cooldownActive
                    ? `Resend paused (${formatCountdown(cooldownSecondsRemaining)})`
                    : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={handleStartOver}
                  disabled={inputsLocked}
                  className="text-primary underline hover:text-primary/80 disabled:opacity-60 disabled:cursor-not-allowed"
                  data-testid="button-reset-start-over"
                >
                  Use a different email
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-4 border-t-2 border-primary/40 text-center text-xs uppercase tracking-wider">
            <Link
              href="/sign-in"
              className="text-primary underline hover:text-primary/80"
              data-testid="link-back-to-sign-in"
            >
              ← Back to sign in
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
