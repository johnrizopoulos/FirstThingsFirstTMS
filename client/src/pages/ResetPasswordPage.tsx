import { FormEvent, useState } from "react";
import { Redirect, useLocation, Link } from "wouter";
import { useSignIn, useUser } from "@clerk/react";
import { useTheme } from "@/contexts/theme";
import { backdropUrlFor } from "@/lib/clerkAppearance";

type Step = "request" | "verify";

function isClerkError(value: unknown): value is { message?: string; longMessage?: string } {
  return typeof value === "object" && value !== null;
}

function describeError(error: unknown): string {
  if (!error) return "";
  if (isClerkError(error)) {
    return error.longMessage || error.message || "Something went wrong. Please try again.";
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
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

  if (userLoaded && isSignedIn) {
    return <Redirect to="/" />;
  }

  const backdropUrl = backdropUrlFor(theme);
  const isBusy = fetchStatus === "fetching";

  const handleRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Enter the email address tied to your account.");
      return;
    }

    const createResult = await signIn.create({ identifier: trimmedEmail });
    if (createResult.error) {
      setErrorMessage(describeError(createResult.error));
      return;
    }

    const sendResult = await signIn.resetPasswordEmailCode.sendCode();
    if (sendResult.error) {
      setErrorMessage(describeError(sendResult.error));
      return;
    }

    setStep("verify");
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      setErrorMessage(describeError(verifyResult.error));
      return;
    }

    const submitResult = await signIn.resetPasswordEmailCode.submitPassword({ password });
    if (submitResult.error) {
      setErrorMessage(describeError(submitResult.error));
      return;
    }

    const finalizeResult = await signIn.finalize({
      navigate: () => {
        setLocation("/");
        return Promise.resolve();
      },
    });
    if (finalizeResult.error) {
      setErrorMessage(describeError(finalizeResult.error));
      return;
    }

    setLocation("/");
  };

  const handleResendCode = async () => {
    setErrorMessage("");
    const sendResult = await signIn.resetPasswordEmailCode.sendCode();
    if (sendResult.error) {
      setErrorMessage(describeError(sendResult.error));
    }
  };

  const handleStartOver = async () => {
    setErrorMessage("");
    setCode("");
    setPassword("");
    setConfirmPassword("");
    const resetResult = await signIn.reset();
    if (resetResult.error) {
      setErrorMessage(describeError(resetResult.error));
      return;
    }
    setStep("request");
  };

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

              {errorMessage && (
                <p
                  className="text-sm text-destructive font-mono"
                  data-testid="text-reset-error"
                >
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="w-full border-2 border-primary bg-primary text-primary-foreground px-4 py-2 font-bold uppercase tracking-widest hover:bg-primary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="button-send-reset-code"
              >
                {isBusy ? "[SENDING…]" : "[SEND RECOVERY CODE]"}
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

              {errorMessage && (
                <p
                  className="text-sm text-destructive font-mono"
                  data-testid="text-reset-error"
                >
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="w-full border-2 border-primary bg-primary text-primary-foreground px-4 py-2 font-bold uppercase tracking-widest hover:bg-primary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="button-submit-new-password"
              >
                {isBusy ? "[UPDATING…]" : "[UPDATE PASSWORD]"}
              </button>

              <div className="flex items-center justify-between text-xs uppercase tracking-wider">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isBusy}
                  className="text-primary underline hover:text-primary/80 disabled:opacity-60"
                  data-testid="button-resend-reset-code"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  onClick={handleStartOver}
                  disabled={isBusy}
                  className="text-primary underline hover:text-primary/80 disabled:opacity-60"
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
