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
  /**
   * Optional human-readable title captured at enqueue time (e.g. the task's
   * name). The pending-changes panel prefers this over a cache lookup so the
   * label stays meaningful even after a cold reload empties the React Query
   * cache. Older persisted entries without this field fall back to the
   * cache-based lookup, so the field is optional and backward-compatible.
   */
  label?: string;
}

export type QueueEvent =
  | { type: "queued"; op: OfflineOpName; size: number }
  | { type: "drained"; processed: number; remaining: number }
  | { type: "conflict"; op: OfflineOpName; error: unknown }
  | { type: "error"; op: OfflineOpName; error: unknown }
  | { type: "removed"; id: string; size: number };

export type RetryQueueEntryStatus =
  | "success"
  | "not-found"
  | "offline"
  | "busy"
  | "no-handler"
  | "network"
  | "conflict"
  | "error";

export interface RetryQueueEntryResult {
  status: RetryQueueEntryStatus;
  error?: unknown;
}

export interface RemovedQueueEntry {
  entry: QueuedOp;
  index: number;
}

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
      queue = parsed
        .filter(
          (e): e is QueuedOp =>
            !!e &&
            typeof e === "object" &&
            typeof (e as QueuedOp).id === "string" &&
            typeof (e as QueuedOp).op === "string" &&
            Array.isArray((e as QueuedOp).args),
        )
        .map((e) => {
          // Preserve the optional label only if it's a non-empty string so
          // legacy entries (no label field) stay valid and a corrupted label
          // can't poison the panel display.
          const next: QueuedOp = {
            id: e.id,
            op: e.op,
            args: e.args,
            enqueuedAt: typeof e.enqueuedAt === "number" ? e.enqueuedAt : 0,
          };
          const rawLabel = (e as { label?: unknown }).label;
          if (typeof rawLabel === "string" && rawLabel.length > 0) {
            next.label = rawLabel;
          }
          return next;
        });
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

export function enqueue(
  op: OfflineOpName,
  args: unknown[],
  label?: string,
): QueuedOp {
  loadFromStorage();
  const entry: QueuedOp = {
    id: makeId(),
    op,
    args,
    enqueuedAt: Date.now(),
  };
  // Only attach a label if the caller supplied a non-empty string so we don't
  // persist a useless `label: undefined` / `label: ""` field.
  if (typeof label === "string" && label.length > 0) {
    entry.label = label;
  }
  queue.push(entry);
  persist();
  emit({ type: "queued", op, size: queue.length });
  return entry;
}

/**
 * Remove a single queued entry by id without touching the rest of the queue.
 *
 * Returns the removed entry and the index it occupied so the caller can offer
 * an "undo" affordance and restore it via `insertQueueEntry` at the original
 * position. Returns null if no entry with that id exists.
 */
export function removeQueueEntry(id: string): RemovedQueueEntry | null {
  loadFromStorage();
  const index = queue.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const [entry] = queue.splice(index, 1);
  persist();
  emit({ type: "removed", id: entry.id, size: queue.length });
  return { entry, index };
}

/**
 * Insert a previously removed entry back into the queue at the given index
 * (clamped to a valid position). Used to implement the "undo" of a discard
 * action. Re-emits a `queued` event so subscribers refresh.
 */
export function insertQueueEntry(entry: QueuedOp, index?: number): void {
  loadFromStorage();
  const target =
    index === undefined
      ? queue.length
      : Math.max(0, Math.min(index, queue.length));
  queue.splice(target, 0, entry);
  persist();
  emit({ type: "queued", op: entry.op, size: queue.length });
}

/**
 * Re-attempt a single queued entry immediately, independent of the FIFO drain.
 *
 * Behaviour mirrors `drainQueue` for that one entry:
 *  - On success: the entry is removed, any temp -> real id mapping a successful
 *    create produced is folded into the rest of the queue, and `drained` is
 *    emitted with `processed: 1`.
 *  - On a network-like failure: the entry is left in place at its current
 *    position so the regular drain (or another retry) can pick it up later.
 *  - On a conflict (404/409/410) or unexpected server error: the entry is
 *    dropped and a `conflict` / `error` event is emitted, matching the way the
 *    drain loop handles the same failure modes.
 *
 * The function reuses the same `draining` mutex as `drainQueue` so it cannot
 * race with an in-flight drain (which would otherwise process the same entry
 * twice). If a drain is already running, returns `{ status: "busy" }`.
 */
export async function retryQueueEntry(
  id: string,
): Promise<RetryQueueEntryResult> {
  loadFromStorage();
  const index = queue.findIndex((e) => e.id === id);
  if (index === -1) return { status: "not-found" };
  if (!isOnline()) return { status: "offline" };
  if (draining) return { status: "busy" };

  const entry = queue[index];
  const handler = handlers[entry.op];
  if (!handler) {
    // Drop now so the entry can't sit in the queue with no way to advance.
    const idx = queue.findIndex((e) => e.id === id);
    if (idx !== -1) queue.splice(idx, 1);
    persist();
    const err = new Error(`No handler registered for "${entry.op}"`);
    emit({ type: "error", op: entry.op, error: err });
    return { status: "no-handler", error: err };
  }

  draining = true;
  try {
    const result = await handler(...entry.args);
    // Re-locate the entry by id in case the queue mutated during the await.
    const idx = queue.findIndex((e) => e.id === id);
    if (idx !== -1) queue.splice(idx, 1);
    const mapping = tempIdMappingFromCreate(entry.op, entry.args, result);
    if (mapping) {
      applyIdMappingToQueue(new Map([[mapping.tempId, mapping.realId]]));
    }
    persist();
    emit({ type: "drained", processed: 1, remaining: queue.length });
    return { status: "success" };
  } catch (err) {
    if (isNetworkLikeError(err)) {
      // Leave the entry in place so the regular drain can pick it up later.
      return { status: "network", error: err };
    }
    const idx = queue.findIndex((e) => e.id === id);
    if (idx !== -1) queue.splice(idx, 1);
    persist();
    if (isConflictError(err)) {
      emit({ type: "conflict", op: entry.op, error: err });
      return { status: "conflict", error: err };
    }
    emit({ type: "error", op: entry.op, error: err });
    return { status: "error", error: err };
  } finally {
    draining = false;
  }
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

/**
 * Rewrite a single queued op's args, swapping any IDs that appear in `idMap`
 * with their real, server-assigned counterparts. Returns a new args array
 * (never mutates the input). For ops that don't reference IDs, returns the
 * original args reference unchanged so callers can cheaply detect no-op.
 */
function rewriteArgsWithIdMap(
  op: OfflineOpName,
  args: unknown[],
  idMap: Map<string, string>,
): unknown[] {
  if (idMap.size === 0) return args;
  const swap = (id: string): string => idMap.get(id) ?? id;

  switch (op) {
    case "createMilestone":
    case "createTask": {
      // The create op may reference a temp `milestoneId` we just learned the
      // real ID for (offline: create milestone, then create task inside it).
      // We deliberately do NOT rewrite `id` here — a create's own id is the
      // temp id we want the server to know it by so we can map the response.
      const input = args[0];
      if (!input || typeof input !== "object") return args;
      const next = { ...(input as Record<string, unknown>) };
      let changed = false;
      if (typeof next.milestoneId === "string") {
        const swapped = swap(next.milestoneId);
        if (swapped !== next.milestoneId) {
          next.milestoneId = swapped;
          changed = true;
        }
      }
      return changed ? [next, ...args.slice(1)] : args;
    }
    case "updateMilestone":
    case "updateTask": {
      const id = args[0];
      const updates = args[1];
      let changed = false;
      const newId = typeof id === "string" ? swap(id) : id;
      if (newId !== id) changed = true;
      let newUpdates = updates;
      if (updates && typeof updates === "object") {
        const candidate = { ...(updates as Record<string, unknown>) };
        if (typeof candidate.milestoneId === "string") {
          const swapped = swap(candidate.milestoneId);
          if (swapped !== candidate.milestoneId) {
            candidate.milestoneId = swapped;
            newUpdates = candidate;
            changed = true;
          }
        }
      }
      return changed ? [newId, newUpdates, ...args.slice(2)] : args;
    }
    case "completeMilestone":
    case "uncompleteMilestone":
    case "deleteMilestone":
    case "completeTask":
    case "uncompleteTask":
    case "deleteTask":
    case "restoreTask":
    case "restoreMilestone": {
      const id = args[0];
      if (typeof id !== "string") return args;
      const newId = swap(id);
      return newId === id ? args : [newId, ...args.slice(1)];
    }
    case "reorderTasks": {
      const ids = args[0];
      if (!Array.isArray(ids)) return args;
      let changed = false;
      const next = ids.map((entry) => {
        if (typeof entry !== "string") return entry;
        const swapped = swap(entry);
        if (swapped !== entry) changed = true;
        return swapped;
      });
      return changed ? [next, ...args.slice(1)] : args;
    }
    case "reorderTasksInMilestone": {
      const ids = args[0];
      const mid = args[1];
      let changed = false;
      let nextIds: unknown = ids;
      if (Array.isArray(ids)) {
        const mapped = ids.map((entry) => {
          if (typeof entry !== "string") return entry;
          const swapped = swap(entry);
          if (swapped !== entry) changed = true;
          return swapped;
        });
        if (changed) nextIds = mapped;
      }
      let nextMid: unknown = mid;
      if (typeof mid === "string") {
        const swapped = swap(mid);
        if (swapped !== mid) {
          nextMid = swapped;
          changed = true;
        }
      }
      return changed ? [nextIds, nextMid, ...args.slice(2)] : args;
    }
    case "cleanupTrash":
    case "emptyTrash":
    default:
      return args;
  }
}

/**
 * After a queued create resolves, walk every still-queued op and rewrite any
 * argument that references the temp ID so it points at the real ID the server
 * just assigned. Mutates `queue` in place and re-persists if anything changed.
 *
 * The mapping is folded directly into the persisted queue (rather than kept
 * in a side-channel map) so it survives a mid-drain crash or reload — the
 * next drain doesn't need to remember anything to keep working.
 */
function applyIdMappingToQueue(idMap: Map<string, string>): void {
  if (idMap.size === 0 || queue.length === 0) return;
  let changed = false;
  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i];
    const nextArgs = rewriteArgsWithIdMap(entry.op, entry.args, idMap);
    if (nextArgs !== entry.args) {
      queue[i] = { ...entry, args: nextArgs };
      changed = true;
    }
  }
  if (changed) persist();
}

/**
 * If a queued create succeeded, extract the temp ID it carried (args[0].id)
 * and the real server-assigned ID (result.id). Returns null if either is
 * missing or they're already equal.
 */
function tempIdMappingFromCreate(
  op: OfflineOpName,
  args: unknown[],
  result: unknown,
): { tempId: string; realId: string } | null {
  if (op !== "createTask" && op !== "createMilestone") return null;
  const input = args[0];
  if (!input || typeof input !== "object") return null;
  const tempId = (input as { id?: unknown }).id;
  if (typeof tempId !== "string") return null;
  if (!result || typeof result !== "object") return null;
  const realId = (result as { id?: unknown }).id;
  if (typeof realId !== "string") return null;
  if (tempId === realId) return null;
  return { tempId, realId };
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
        const result = await handler(...entry.args);
        queue.shift();
        // If this op was a create that produced a new server entity, fold the
        // temp -> real id mapping into every still-queued op so subsequent
        // mutations don't 404 against a temp id the server never saw.
        const mapping = tempIdMappingFromCreate(entry.op, entry.args, result);
        if (mapping) {
          applyIdMappingToQueue(new Map([[mapping.tempId, mapping.realId]]));
        }
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
  label?: string,
): Promise<T> {
  if (!isOnline()) {
    enqueue(op, args, label);
    return stub;
  }
  try {
    return await fn();
  } catch (err) {
    if (isNetworkLikeError(err)) {
      enqueue(op, args, label);
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
