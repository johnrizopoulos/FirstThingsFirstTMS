import {
  isOnline,
  isNetworkLikeError,
  subscribeOnlineStatus,
} from "./onlineStatus";

const STORAGE_KEY = "fft.offlineMutationQueue.v1";
const OWNER_KEY = "fft.offlineMutationQueueOwner.v1";

export type OfflineOpName =
  | "createMilestone"
  | "updateMilestone"
  | "completeMilestone"
  | "uncompleteMilestone"
  | "deleteMilestone"
  | "createTask"
  | "updateTask"
  | "completeTask"
  | "uncompleteTask"
  | "deleteTask"
  | "reorderTasks"
  | "reorderTasksInMilestone"
  | "cleanupTrash"
  | "emptyTrash"
  | "restoreTask"
  | "restoreMilestone";

export interface QueuedOp {
  id: string;
  op: OfflineOpName;
  args: unknown[];
  enqueuedAt: number;
}

export type QueueEvent =
  | { type: "queued"; op: OfflineOpName; size: number }
  | { type: "drained"; processed: number; remaining: number }
  | { type: "conflict"; op: OfflineOpName; error: unknown }
  | { type: "error"; op: OfflineOpName; error: unknown };

type Handler = (...args: unknown[]) => Promise<unknown>;

const listeners = new Set<(e: QueueEvent) => void>();
let handlers: Partial<Record<OfflineOpName, Handler>> = {};

let queue: QueuedOp[] = [];
let loaded = false;
let draining = false;
let bridgeUnsub: (() => void) | null = null;

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function loadFromStorage(): void {
  if (loaded) return;
  loaded = true;
  const ls = safeStorage();
  if (!ls) return;
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      queue = parsed.filter(
        (e): e is QueuedOp =>
          !!e &&
          typeof e === "object" &&
          typeof (e as QueuedOp).id === "string" &&
          typeof (e as QueuedOp).op === "string" &&
          Array.isArray((e as QueuedOp).args),
      );
    }
  } catch {
    // ignore corrupt queue — start fresh
  }
}

function persist(): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    if (queue.length === 0) {
      ls.removeItem(STORAGE_KEY);
    } else {
      ls.setItem(STORAGE_KEY, JSON.stringify(queue));
    }
  } catch {
    // ignore quota/serialization errors
  }
}

function emit(event: QueueEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // isolate listener errors so one bad subscriber can't break others
    }
  });
}

export function subscribeQueue(
  listener: (event: QueueEvent) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getQueueSnapshot(): QueuedOp[] {
  loadFromStorage();
  return queue.slice();
}

export function getQueueSize(): number {
  loadFromStorage();
  return queue.length;
}

/**
 * Drop every queued mutation and clear the persisted backlog.
 *
 * Use this when the authenticated user changes (sign-out, account switch) so
 * that operations queued under the previous account can't be replayed under
 * the new account's session and silently mutate the wrong user's data.
 */
export function clearQueue(): void {
  loadFromStorage();
  queue = [];
  const ls = safeStorage();
  if (ls) {
    try {
      ls.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Reconcile the persisted queue's owner with the currently signed-in user.
 *
 * Returns `true` if the existing queue belonged to a different user (or there
 * was no recorded owner) and the queue was therefore cleared. Returns `false`
 * if the owner matches and the queue is safe to drain.
 *
 * This MUST be called before any drain on app startup, so that a backlog
 * persisted under user A is never replayed against user B's session on the
 * same browser. Pass `null` for a signed-out state.
 */
export function syncQueueOwner(userId: string | null): boolean {
  const ls = safeStorage();
  const normalized = userId ?? "";
  let stored: string | null = null;
  if (ls) {
    try {
      stored = ls.getItem(OWNER_KEY);
    } catch {
      stored = null;
    }
  }
  if (stored === normalized) {
    return false;
  }
  // Owner mismatch (different user, signed out, or first run). Drop the
  // backlog before any drain can replay it under the wrong account.
  clearQueue();
  if (ls) {
    try {
      ls.setItem(OWNER_KEY, normalized);
    } catch {
      // ignore
    }
  }
  return true;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function enqueue(op: OfflineOpName, args: unknown[]): QueuedOp {
  loadFromStorage();
  const entry: QueuedOp = {
    id: makeId(),
    op,
    args,
    enqueuedAt: Date.now(),
  };
  queue.push(entry);
  persist();
  emit({ type: "queued", op, size: queue.length });
  return entry;
}

export function registerHandlers(
  next: Partial<Record<OfflineOpName, Handler>>,
): void {
  handlers = { ...handlers, ...next };
}

function isConflictError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const message = (err as { message?: unknown }).message;
  if (typeof message !== "string") return false;
  return /^(404|409|410):/.test(message);
}

export async function drainQueue(): Promise<{
  processed: number;
  remaining: number;
}> {
  loadFromStorage();
  if (draining) return { processed: 0, remaining: queue.length };
  draining = true;
  let processed = 0;
  try {
    while (queue.length > 0) {
      if (!isOnline()) break;
      const entry = queue[0];
      const handler = handlers[entry.op];
      if (!handler) {
        // Unknown op — drop and report so we don't get stuck forever.
        queue.shift();
        persist();
        emit({
          type: "error",
          op: entry.op,
          error: new Error(`No handler registered for "${entry.op}"`),
        });
        continue;
      }
      try {
        await handler(...entry.args);
        queue.shift();
        persist();
        processed += 1;
      } catch (err) {
        if (isNetworkLikeError(err)) {
          // Still offline — stop here, leave entry at the head, retry later.
          break;
        }
        // Drop the entry so we don't stall the queue forever.
        queue.shift();
        persist();
        if (isConflictError(err)) {
          emit({ type: "conflict", op: entry.op, error: err });
        } else {
          emit({ type: "error", op: entry.op, error: err });
        }
      }
    }
  } finally {
    draining = false;
    if (processed > 0) {
      emit({ type: "drained", processed, remaining: queue.length });
    }
  }
  return { processed, remaining: queue.length };
}

export function startQueueBridge(): () => void {
  if (bridgeUnsub) return bridgeUnsub;
  loadFromStorage();
  const unsub = subscribeOnlineStatus((online) => {
    if (online) {
      void drainQueue();
    }
  });
  bridgeUnsub = () => {
    unsub();
    bridgeUnsub = null;
  };
  // If we're already online with a backlog, drain immediately.
  if (isOnline() && queue.length > 0) {
    void drainQueue();
  }
  return bridgeUnsub;
}

export async function executeOrQueue<T>(
  op: OfflineOpName,
  args: unknown[],
  stub: T,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isOnline()) {
    enqueue(op, args);
    return stub;
  }
  try {
    return await fn();
  } catch (err) {
    if (isNetworkLikeError(err)) {
      enqueue(op, args);
      return stub;
    }
    throw err;
  }
}

export function __resetOfflineQueueForTests(): void {
  queue = [];
  loaded = false;
  draining = false;
  handlers = {};
  listeners.clear();
  if (bridgeUnsub) {
    bridgeUnsub();
    bridgeUnsub = null;
  }
  const ls = safeStorage();
  if (ls) {
    try {
      ls.removeItem(STORAGE_KEY);
      ls.removeItem(OWNER_KEY);
    } catch {
      // ignore
    }
  }
}
