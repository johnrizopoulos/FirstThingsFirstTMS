import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { queryClient } from "@/lib/queryClient";
import { clearNetworkError } from "@/lib/onlineStatus";
import {
  drainQueue,
  registerHandlers,
  startQueueBridge,
  subscribeQueue,
  syncQueueOwner,
  type QueueEvent,
} from "@/lib/offlineQueue";
import { toast } from "@/hooks/use-toast";
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
    const unsubscribe = subscribeQueue((event: QueueEvent) => {
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

  if (online && !showReconnected) return null;

  const offline = !online;

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
      </div>
    </div>
  );
}

export default OfflineBanner;
