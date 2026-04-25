import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { queryClient } from "@/lib/queryClient";
import { clearNetworkError } from "@/lib/onlineStatus";
import {
  drainQueue,
  getQueueSize,
  getQueueSnapshot,
  insertQueueEntry,
  registerHandlers,
  removeQueueEntry,
  retryQueueEntry,
  startQueueBridge,
  subscribeQueue,
  syncQueueOwner,
  type OfflineOpName,
  type QueueEvent,
  type QueuedOp,
} from "@/lib/offlineQueue";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { rawMutations } from "@/lib/api";

function friendlyOpName(op: string): string {
  switch (op) {
    case "createTask":
      return "create task";
    case "updateTask":
      return "update task";
    case "completeTask":
      return "complete task";
    case "uncompleteTask":
      return "uncomplete task";
    case "deleteTask":
      return "delete task";
    case "restoreTask":
      return "restore task";
    case "createMilestone":
      return "create milestone";
    case "updateMilestone":
      return "update milestone";
    case "completeMilestone":
      return "complete milestone";
    case "uncompleteMilestone":
      return "uncomplete milestone";
    case "deleteMilestone":
      return "delete milestone";
    case "restoreMilestone":
      return "restore milestone";
    case "reorderTasks":
    case "reorderTasksInMilestone":
      return "reorder tasks";
    case "cleanupTrash":
    case "emptyTrash":
      return "clean up trash";
    default:
      return op;
  }
}

const TASK_OPS = new Set<OfflineOpName>([
  "createTask",
  "updateTask",
  "completeTask",
  "uncompleteTask",
  "deleteTask",
  "restoreTask",
]);

const MILESTONE_OPS = new Set<OfflineOpName>([
  "createMilestone",
  "updateMilestone",
  "completeMilestone",
  "uncompleteMilestone",
  "deleteMilestone",
  "restoreMilestone",
]);

function lookupTitleById(kind: "task" | "milestone", id: string): string | null {
  const keys =
    kind === "task"
      ? ["/api/tasks", "/api/tasks/active", "/api/tasks/focus", "/api/tasks/completed"]
      : ["/api/milestones", "/api/milestones/active", "/api/milestones/completed"];
  for (const key of keys) {
    const data = queryClient.getQueryData<unknown>([key]);
    if (!Array.isArray(data)) continue;
    const match = (data as Array<{ id?: unknown; title?: unknown }>).find(
      (item) => item && typeof item === "object" && item.id === id,
    );
    if (match && typeof match.title === "string" && match.title.length > 0) {
      return match.title;
    }
  }
  return null;
}

function describeQueuedOp(entry: QueuedOp): string {
  const label = friendlyOpName(entry.op);
  const args = entry.args as unknown[];
  const first = args[0];

  if (
    (entry.op === "createTask" || entry.op === "createMilestone") &&
    first &&
    typeof first === "object" &&
    typeof (first as { title?: unknown }).title === "string"
  ) {
    return `${label}: ${(first as { title: string }).title}`;
  }

  if (entry.op === "updateTask" || entry.op === "updateMilestone") {
    const updates = args[1];
    if (
      updates &&
      typeof updates === "object" &&
      typeof (updates as { title?: unknown }).title === "string"
    ) {
      return `${label}: ${(updates as { title: string }).title}`;
    }
    if (typeof first === "string") {
      const kind = entry.op === "updateTask" ? "task" : "milestone";
      const title = lookupTitleById(kind, first);
      if (title) return `${label}: ${title}`;
    }
  }

  if (typeof first === "string") {
    if (TASK_OPS.has(entry.op)) {
      const title = lookupTitleById("task", first);
      if (title) return `${label}: ${title}`;
    } else if (MILESTONE_OPS.has(entry.op)) {
      const title = lookupTitleById("milestone", first);
      if (title) return `${label}: ${title}`;
    }
  }

  if (entry.op === "reorderTasks" || entry.op === "reorderTasksInMilestone") {
    const ids = first;
    if (Array.isArray(ids)) {
      return `${label} (${ids.length})`;
    }
  }

  return label;
}

let handlersRegistered = false;
function ensureHandlersRegistered() {
  if (handlersRegistered) return;
  handlersRegistered = true;
  // Use the raw (non-queueing) network helpers so a transient drain failure
  // surfaces as a real network error to the queue — keeping the entry at the
  // head of the queue rather than re-enqueueing it at the tail.
  registerHandlers(rawMutations);
}

export function OfflineBanner() {
  const online = useOnlineStatus();
  const { user, isLoaded: userLoaded } = useUser();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [queueSize, setQueueSize] = useState<number>(() => {
    try {
      return getQueueSize();
    } catch {
      return 0;
    }
  });
  const [queueSnapshot, setQueueSnapshot] = useState<QueuedOp[]>(() => {
    try {
      return getQueueSnapshot();
    } catch {
      return [];
    }
  });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(() => new Set());

  const markRetrying = useCallback((id: string, on: boolean) => {
    setRetryingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleDiscard = useCallback((entry: QueuedOp) => {
    const removed = removeQueueEntry(entry.id);
    if (!removed) return;
    const label = describeQueuedOp(removed.entry);
    toast({
      title: "Discarded queued change",
      description: label,
      action: (
        <ToastAction
          altText="Undo discard"
          data-testid={`button-undo-discard-${entry.id}`}
          onClick={() => insertQueueEntry(removed.entry, removed.index)}
        >
          Undo
        </ToastAction>
      ),
    });
  }, []);

  const handleRetry = useCallback(
    async (entry: QueuedOp) => {
      markRetrying(entry.id, true);
      try {
        const result = await retryQueueEntry(entry.id);
        const label = describeQueuedOp(entry);
        switch (result.status) {
          case "success":
            toast({
              title: "Synced queued change",
              description: label,
            });
            void queryClient.invalidateQueries();
            break;
          case "offline":
            toast({
              variant: "destructive",
              title: "Still offline",
              description: "Reconnect to retry queued changes.",
            });
            break;
          case "busy":
            toast({
              title: "Sync already in progress",
              description: "Try again in a moment.",
            });
            break;
          case "network":
            toast({
              variant: "destructive",
              title: "Couldn't reach the server",
              description: `Will retry automatically: ${label}`,
            });
            break;
          case "not-found":
            // Snapshot is stale — nothing to do; the listener will refresh.
            break;
          case "no-handler":
          case "conflict":
          case "error":
            // The shared queue listener already toasts conflict/error events.
            break;
        }
      } finally {
        markRetrying(entry.id, false);
      }
    },
    [markRetrying],
  );

  // Gate the queue bridge on auth readiness. The persisted queue is owner-
  // scoped: on every sign-in/sign-out/account-switch we reconcile the stored
  // owner id BEFORE registering handlers or starting the bridge, so a backlog
  // queued under user A can never replay against user B's session on the
  // same browser. Dropping `userLoaded` from the gate would re-introduce the
  // race the previous review flagged (drain firing before auth resolves).
  useEffect(() => {
    if (!userLoaded) return;
    const currentUserId = user?.id ?? null;
    syncQueueOwner(currentUserId);
    ensureHandlersRegistered();
    const release = startQueueBridge();
    // Re-read the snapshot after owner reconciliation in case clearQueue ran.
    setQueueSize(getQueueSize());
    setQueueSnapshot(getQueueSnapshot());
    const unsubscribe = subscribeQueue((event: QueueEvent) => {
      // Keep the count + list in sync on every queue change so the badge
      // accurately reflects what's still pending.
      setQueueSize(getQueueSize());
      setQueueSnapshot(getQueueSnapshot());
      if (event.type === "conflict") {
        toast({
          variant: "destructive",
          title: "Couldn't sync a saved change",
          description: `The item for "${friendlyOpName(event.op)}" no longer exists on the server. The queued change was discarded.`,
        });
      } else if (event.type === "error") {
        toast({
          variant: "destructive",
          title: "Couldn't sync a saved change",
          description: `Failed to ${friendlyOpName(event.op)} after reconnecting. The queued change was discarded.`,
        });
      } else if (event.type === "drained" && event.processed > 0) {
        // Refresh caches after the backlog flushed so the UI reflects server state.
        void queryClient.invalidateQueries();
      }
    });
    return () => {
      unsubscribe();
      release();
    };
  }, [userLoaded, user?.id]);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowReconnected(false);
      return;
    }
    if (online && wasOffline) {
      clearNetworkError();
      // Drain the queued mutations first so the server sees them, then refresh
      // caches. The queue's "drained" event also triggers an invalidate, but we
      // also invalidate here in case there was nothing queued (pure reconnect).
      // Gate on `userLoaded`: if the auth-gated effect above hasn't reconciled
      // the queue's owner yet, draining now could replay another account's
      // backlog. When auth isn't ready, only refresh caches.
      if (userLoaded) {
        void drainQueue().then(() => {
          void queryClient.invalidateQueries();
        });
      } else {
        void queryClient.invalidateQueries();
      }
      setShowReconnected(true);
      const t = window.setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 2500);
      return () => window.clearTimeout(t);
    }
  }, [online, wasOffline, userLoaded]);

  // Collapse the details panel automatically once the queue is empty so we
  // don't strand an open-but-empty popover after a successful drain.
  useEffect(() => {
    if (queueSize === 0 && detailsOpen) {
      setDetailsOpen(false);
    }
  }, [queueSize, detailsOpen]);

  const visibleEntries = useMemo(() => queueSnapshot.slice(0, 8), [queueSnapshot]);
  const overflowCount = Math.max(0, queueSnapshot.length - visibleEntries.length);

  if (online && !showReconnected) return null;

  const offline = !online;
  const showPendingBadge = queueSize > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={offline ? "banner-offline" : "banner-reconnected"}
      className={
        "fixed left-0 right-0 top-0 z-[60] safe-pad-top safe-pad-x border-b font-mono text-xs " +
        (offline
          ? "bg-background text-destructive border-destructive"
          : "bg-background text-primary border-primary")
      }
    >
      <div className="flex items-center justify-center gap-2 px-3 py-1.5 tracking-wider uppercase">
        <span
          aria-hidden="true"
          data-testid={offline ? "indicator-offline-dot" : "indicator-online-dot"}
          className={
            "inline-block w-2 h-2 " +
            (offline ? "bg-destructive animate-blink" : "bg-primary")
          }
        />
        {offline ? (
          <span data-testid="text-offline-message">
            OFFLINE &mdash; CHANGES WILL RETRY WHEN BACK ONLINE
          </span>
        ) : (
          <span data-testid="text-reconnected-message">
            LINK_OK &mdash; RECONNECTED, SYNCING&hellip;
          </span>
        )}
        {showPendingBadge ? (
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            aria-controls="offline-queue-details"
            data-testid="button-pending-changes"
            className={
              "ml-1 inline-flex items-center gap-1 border px-1.5 py-0.5 tracking-wider uppercase " +
              "hover:bg-foreground/5 focus:outline-none focus-visible:ring-1 " +
              (offline
                ? "border-destructive text-destructive"
                : "border-primary text-primary")
            }
          >
            <span data-testid="text-pending-count">
              {queueSize} PENDING
            </span>
            <span aria-hidden="true">{detailsOpen ? "\u25B2" : "\u25BC"}</span>
          </button>
        ) : null}
      </div>
      {showPendingBadge && detailsOpen ? (
        <div
          id="offline-queue-details"
          data-testid="panel-pending-changes"
          className={
            "border-t px-3 py-2 normal-case tracking-normal text-left " +
            (offline ? "border-destructive/40" : "border-primary/40")
          }
        >
          <ul className="space-y-1">
            {visibleEntries.map((entry) => {
              const isRetrying = retryingIds.has(entry.id);
              const retryDisabled = !online || isRetrying;
              return (
                <li
                  key={entry.id}
                  data-testid={`item-pending-${entry.id}`}
                  className="flex items-center gap-2"
                >
                  <span className="flex-1 truncate">
                    {describeQueuedOp(entry)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleRetry(entry)}
                    disabled={retryDisabled}
                    aria-label={`Retry ${describeQueuedOp(entry)} now`}
                    title={
                      online
                        ? "Retry this change now"
                        : "Reconnect to retry"
                    }
                    data-testid={`button-retry-pending-${entry.id}`}
                    className={
                      "shrink-0 border px-1.5 py-0.5 text-[0.7rem] uppercase tracking-wider " +
                      "hover:bg-foreground/5 focus:outline-none focus-visible:ring-1 " +
                      "disabled:opacity-50 disabled:cursor-not-allowed " +
                      (offline
                        ? "border-destructive/60 text-destructive"
                        : "border-primary/60 text-primary")
                    }
                  >
                    {isRetrying ? "\u2026" : "Retry"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDiscard(entry)}
                    disabled={isRetrying}
                    aria-label={`Discard ${describeQueuedOp(entry)}`}
                    title="Discard this queued change (with undo)"
                    data-testid={`button-discard-pending-${entry.id}`}
                    className={
                      "shrink-0 border px-1.5 py-0.5 text-[0.7rem] uppercase tracking-wider " +
                      "hover:bg-foreground/5 focus:outline-none focus-visible:ring-1 " +
                      "disabled:opacity-50 disabled:cursor-not-allowed " +
                      (offline
                        ? "border-destructive/60 text-destructive"
                        : "border-primary/60 text-primary")
                    }
                  >
                    Discard
                  </button>
                </li>
              );
            })}
            {overflowCount > 0 ? (
              <li
                data-testid="text-pending-overflow"
                className="opacity-75"
              >
                +{overflowCount} more
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default OfflineBanner;
