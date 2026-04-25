export type ClerkErrorEntry = {
  code?: string;
  message?: string;
  longMessage?: string;
  meta?: Record<string, unknown>;
};

export type ClerkErrorShape = {
  status?: number;
  retryAfter?: number;
  errors?: ClerkErrorEntry[];
  message?: string;
  longMessage?: string;
  code?: string;
  meta?: Record<string, unknown>;
};

const RATE_LIMIT_CODES = new Set<string>([
  "user_locked",
  "too_many_requests",
  "rate_limit_exceeded",
  "signup_rate_limit_exceeded",
  "verification_rate_limit_exceeded",
  "lockout",
]);

const DEFAULT_COOLDOWN_SECONDS = 5 * 60;

export function asClerkError(value: unknown): ClerkErrorShape | null {
  if (!value || typeof value !== "object") return null;
  return value as ClerkErrorShape;
}

export function getErrorEntries(error: ClerkErrorShape | null): ClerkErrorEntry[] {
  if (!error) return [];
  if (Array.isArray(error.errors) && error.errors.length > 0) return error.errors;
  if (typeof error.code === "string") {
    return [
      {
        code: error.code,
        message: error.message,
        longMessage: error.longMessage,
        meta: error.meta,
      },
    ];
  }
  return [];
}

export function describeError(error: unknown): string {
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

export function detectRateLimit(
  error: unknown,
): { limited: boolean; retryAfterSeconds: number } {
  const shape = asClerkError(error);
  if (!shape) return { limited: false, retryAfterSeconds: 0 };

  const entries = getErrorEntries(shape);
  const matchedByCode = entries.some((entry) => {
    const code = (entry.code || "").toLowerCase();
    if (!code) return false;
    if (RATE_LIMIT_CODES.has(code)) return true;
    return (
      code.includes("lockout") ||
      code.includes("rate_limit") ||
      code.includes("too_many")
    );
  });

  const matchedByStatus = shape.status === 429;
  if (!matchedByCode && !matchedByStatus) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  let retryAfter = typeof shape.retryAfter === "number" ? shape.retryAfter : 0;
  if (!retryAfter) {
    for (const entry of entries) {
      const meta = entry.meta as
        | { retryAfter?: number; retry_after?: number; retryAfterSeconds?: number }
        | undefined;
      const candidate =
        meta?.retryAfter ?? meta?.retry_after ?? meta?.retryAfterSeconds;
      if (typeof candidate === "number" && candidate > 0) {
        retryAfter = candidate;
        break;
      }
    }
  }
  if (!retryAfter || retryAfter < 0) {
    retryAfter = DEFAULT_COOLDOWN_SECONDS;
  }
  return { limited: true, retryAfterSeconds: retryAfter };
}

export function formatCountdown(secondsRemaining: number): string {
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
