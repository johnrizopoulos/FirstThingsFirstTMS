import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Redirect, useLocation, Link } from "wouter";
import { useSignIn, useUser } from "@clerk/react";
import { useTheme } from "@/contexts/theme";
import { backdropUrlFor } from "@/lib/clerkAppearance";

type Step = "request" | "verify";

type ClerkErrorEntry = {
  code?: string;
  message?: string;
  longMessage?: string;
  meta?: Record<string, unknown>;
};

type ClerkErrorShape = {
  status?: number;
  retryAfter?: number;
  errors?: ClerkErrorEntry[];
  message?: string;
  longMessage?: string;
  code?: string;
  meta?: Record<string, unknown>;
};

const SUPPORT_EMAIL = "support@firstthingsfirst.app";

const RATE_LIMIT_CODES = new Set<string>([
  "user_locked",
  "too_many_requests",
  "rate_limit_exceeded",
  "signup_rate_limit_exceeded",
  "verification_rate_limit_exceeded",
  "lockout",
]);

function asClerkError(value: unknown): ClerkErrorShape | null {
  if (!value || typeof value !== "object") return null;
  return value as ClerkErrorShape;
}

function getErrorEntries(error: ClerkErrorShape | null): ClerkErrorEntry[] {
  if (!error) return [];
  if (Array.isArray(error.errors) && error.errors.length > 0) return error.errors;
  if (typeof error.code === "string") {
    return [{ code: error.code, message: error.message, longMessage: error.longMessage, meta: error.meta }];
  }
  return [];
}

function describeError(error: unknown): string {
  const shape = asClerkError(error);
  if (!shape) {
    if (error instanceof Error) return error.message;
    return "Something went wrong. Please try again.";
  }
  const first = getErrorEntries(shape)[0];
  return (
    first?.longMessage ||
    first?.message ||
    shape.longMessage ||
    shape.message ||
    "Something went wrong. Please try again."
  );
}

function detectRateLimit(error: unknown): { limited: boolean; retryAfterSeconds: number } {
  const shape = asClerkError(error);
  if (!shape) return { limited: false, retryAfterSeconds: 0 };

  const entries = getErrorEntries(shape);
  const matchedByCode = entries.some((entry) => {
    const code = (entry.code || "").toLowerCase();
    if (!code) return false;
    if (RATE_LIMIT_CODES.has(code)) return true;
    return code.includes("lockout") || code.includes("rate_limit") || code.includes("too_many");
  });

  const matchedByStatus = shape.status === 429;
  if (!matchedByCode && !matchedByStatus) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  let retryAfter = typeof shape.retryAfter === "number" ? shape.retryAfter : 0;
  if (!retryAfter) {
    for (const entry of entries) {
      const meta = entry.meta as { retryAfter?: number; retry_after?: number; retryAfterSeconds?: number } | undefined;
      const candidate = meta?.retryAfter ?? meta?.retry_after ?? meta?.retryAfterSeconds;
      if (typeof candidate === "number" && candidate > 0) {
        retryAfter = candidate;
        break;
      }
    }
  }
  if (!retryAfter || retryAfter < 0) {
    retryAfter = 5 * 60;
  }
  return { limited: true, retryAfterSeconds: retryAfter };
}

function formatCountdown(secondsRemaining: number): string {
  const safe = Math.max(0, Math.ceil(secondsRemaining));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes <= 0) {
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }
  if (seconds === 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export default function ResetPasswordPage() {
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const { signIn, fetchStatus } = useSignIn();
  const { theme } = useTheme();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
            href={`mailto:${SUPPORT_EMAIL}?subject=Password%20reset%20locked%20out`}
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
      <div className="fixed inset-0 crt-overlay pointer-events-none z-50" />
      <main className="relative z-10 min-h-screen flex items-center justify-center px-4 py-16">
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
      </main>
    </div>
  );
}
