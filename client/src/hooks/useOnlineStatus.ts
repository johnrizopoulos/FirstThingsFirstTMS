import { useEffect, useState } from "react";
import {
  isOnline,
  subscribeOnlineStatus,
  installOnlineStatusBridge,
} from "@/lib/onlineStatus";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => isOnline());

  useEffect(() => {
    const teardown = installOnlineStatusBridge();
    setOnline(isOnline());
    const unsubscribe = subscribeOnlineStatus(setOnline);
    return () => {
      unsubscribe();
      teardown();
    };
  }, []);

  return online;
}
