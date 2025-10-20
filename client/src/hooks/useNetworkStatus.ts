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
      console.log("🟢 [NETWORK] Connection restored");
      setIsOnline(true);

      // If we were offline before, trigger reconnect event
      if (wasOffline) {
        console.log("🔄 [NETWORK] Dispatching reconnect event");
        window.dispatchEvent(new CustomEvent("network-reconnected"));
      }

      setWasOffline(false);
    };

    const handleOffline = () => {
      console.log("🔴 [NETWORK] Connection lost");
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
