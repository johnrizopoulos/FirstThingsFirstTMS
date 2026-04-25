import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { queryClient } from "@/lib/queryClient";
import { clearNetworkError } from "@/lib/onlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowReconnected(false);
      return;
    }
    if (online && wasOffline) {
      clearNetworkError();
      void queryClient.invalidateQueries();
      setShowReconnected(true);
      const t = window.setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 2500);
      return () => window.clearTimeout(t);
    }
  }, [online, wasOffline]);

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
            LINK_OK &mdash; RECONNECTED, SYNCING…
          </span>
        )}
      </div>
    </div>
  );
}

export default OfflineBanner;
