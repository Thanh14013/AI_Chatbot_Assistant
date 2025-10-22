/**
 * useNetworkStatus Hook
 * Detects online/offline network status and dispatches reconnect events
 */

import { useState, useEffect } from "react";
import type { NetworkStatus } from "../types/offline-message.type";

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);

      // If we were offline before, trigger reconnect event
      if (wasOffline) {
        window.dispatchEvent(new CustomEvent("network-reconnected"));
      }

      setWasOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    // Listen to browser online/offline events
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}

export default useNetworkStatus;
