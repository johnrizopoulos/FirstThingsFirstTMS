export type OnlineStatusListener = (online: boolean) => void;

const listeners = new Set<OnlineStatusListener>();

let networkErrorAt = 0;

const NETWORK_ERROR_GRACE_MS = 8000;

function browserOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export function isOnline(now: number = Date.now()): boolean {
  if (!browserOnline()) return false;
  if (networkErrorAt && now - networkErrorAt < NETWORK_ERROR_GRACE_MS) {
    return false;
  }
  return true;
}

function emit(): void {
  const value = isOnline();
  listeners.forEach((listener) => {
    try {
      listener(value);
    } catch {
      // Swallow listener errors so one bad subscriber can't break others.
    }
  });
}

export function subscribeOnlineStatus(listener: OnlineStatusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportNetworkError(now: number = Date.now()): void {
  networkErrorAt = now;
  emit();
}

export function clearNetworkError(): void {
  if (networkErrorAt === 0) return;
  networkErrorAt = 0;
  emit();
}

export function isNetworkLikeError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object" && err !== null) {
    const name = (err as { name?: unknown }).name;
    const message = (err as { message?: unknown }).message;
    if (name === "TypeError") return true;
    if (typeof message === "string") {
      const m = message.toLowerCase();
      if (
        m.includes("failed to fetch") ||
        m.includes("network request failed") ||
        m.includes("load failed") ||
        m.includes("networkerror")
      ) {
        return true;
      }
    }
  }
  return false;
}

let bridgeRefCount = 0;
let bridgeHandlers: { online: () => void; offline: () => void } | null = null;

export function installOnlineStatusBridge(): () => void {
  if (typeof window === "undefined") return () => {};

  if (bridgeRefCount === 0) {
    const handleOnline = () => {
      networkErrorAt = 0;
      emit();
    };
    const handleOffline = () => {
      emit();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    bridgeHandlers = { online: handleOnline, offline: handleOffline };
  }
  bridgeRefCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    bridgeRefCount -= 1;
    if (bridgeRefCount === 0 && bridgeHandlers) {
      window.removeEventListener("online", bridgeHandlers.online);
      window.removeEventListener("offline", bridgeHandlers.offline);
      bridgeHandlers = null;
    }
  };
}

export async function trackedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    const res = await fetch(input, init);
    clearNetworkError();
    return res;
  } catch (err) {
    if (isNetworkLikeError(err)) {
      reportNetworkError();
    }
    throw err;
  }
}

export function __resetOnlineStatusForTests(): void {
  listeners.clear();
  networkErrorAt = 0;
  if (bridgeHandlers && typeof window !== "undefined") {
    window.removeEventListener("online", bridgeHandlers.online);
    window.removeEventListener("offline", bridgeHandlers.offline);
  }
  bridgeHandlers = null;
  bridgeRefCount = 0;
}
