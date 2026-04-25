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

export type CooldownFlow = "sign-in" | "reset-password";

export type StoredCooldown = {
  identifier: string;
  until: number;
};

const COOLDOWN_STORAGE_PREFIX = "clerk-cooldown:";

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function flowPrefix(flow: CooldownFlow): string {
  return `${COOLDOWN_STORAGE_PREFIX}${flow}:`;
}

function cooldownStorageKey(flow: CooldownFlow, identifier: string): string {
  return `${flowPrefix(flow)}${identifier}`;
}

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function removeKey(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readEntry(storage: Storage, key: string): number | null {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  const until = Number.parseInt(raw, 10);
  if (!Number.isFinite(until) || until <= Date.now()) {
    removeKey(storage, key);
    return null;
  }
  return until;
}

function collectFlowKeys(storage: Storage, flow: CooldownFlow): string[] {
  const prefix = flowPrefix(flow);
  const keys: string[] = [];
  let length = 0;
  try {
    length = storage.length;
  } catch {
    return keys;
  }
  for (let i = 0; i < length; i++) {
    let key: string | null = null;
    try {
      key = storage.key(i);
    } catch {
      continue;
    }
    if (key && key.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

export function persistCooldown(
  flow: CooldownFlow,
  identifier: string,
  until: number,
): void {
  const storage = safeStorage();
  if (!storage) return;
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return;
  if (!Number.isFinite(until) || until <= Date.now()) return;
  try {
    storage.setItem(cooldownStorageKey(flow, normalized), String(until));
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function loadCooldown(
  flow: CooldownFlow,
  identifier: string,
): number | null {
  const storage = safeStorage();
  if (!storage) return null;
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return null;
  return readEntry(storage, cooldownStorageKey(flow, normalized));
}

export function loadActiveCooldown(flow: CooldownFlow): StoredCooldown | null {
  const storage = safeStorage();
  if (!storage) return null;
  const prefix = flowPrefix(flow);
  let best: StoredCooldown | null = null;
  for (const key of collectFlowKeys(storage, flow)) {
    const until = readEntry(storage, key);
    if (until === null) continue;
    if (!best || until > best.until) {
      best = { identifier: key.slice(prefix.length), until };
    }
  }
  return best;
}

export function clearCooldown(
  flow: CooldownFlow,
  identifier: string,
): void {
  const storage = safeStorage();
  if (!storage) return;
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return;
  removeKey(storage, cooldownStorageKey(flow, normalized));
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
