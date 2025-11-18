/**
 * 🔥 TOKEN REFRESH MANAGER
 * Automatically refreshes access token before it expires
 * Prevents UI freeze after 1 hour of inactivity
 *
 * Root Cause Fix:
 * - Access token expires after 1 hour (JWT_ACCESS_EXPIRATION=1h)
 * - Client only refreshes on 401 errors (when API called)
 * - If user idle → token expires → next click fails → UI freezes
 *
 * Solution:
 * - Monitor token expiry time
 * - Auto-refresh 2 minutes before expiration (at 58 minutes)
 * - Runs in background even during user inactivity
 */

import {
  getAccessToken,
  setAccessToken,
  isTokenExpired,
  getTokenExpiry,
  clearTokens,
} from "../utils/token.util";
import axios from "axios";
import type { RefreshTokenResponse } from "../types";

class TokenRefreshService {
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private refreshAttempts = 0;
  private maxRefreshAttempts = 3;

  /**
   * Get backend URL for refresh endpoint
   */
  private getBackendURL(): string {
    const isDevelopment = import.meta.env.DEV;
    const apiBasePath = import.meta.env.VITE_API_BASE_URL || "/api";

    if (isDevelopment) {
      return apiBasePath;
    } else {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      if (!backendUrl) {
        console.error("[TokenRefresh] VITE_BACKEND_URL not set!");
        throw new Error("Backend URL required");
      }
      return `${backendUrl}${apiBasePath}`;
    }
  }

  /**
   * Start monitoring token expiry
   */
  start(): void {
    console.log("[TokenRefresh] Starting monitor...");
    this.stop(); // Clear any existing timer
    this.scheduleNextRefresh();

    // Also listen for storage events (multi-tab token updates)
    window.addEventListener("storage", this.handleStorageChange);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    console.log("[TokenRefresh] Stopping monitor...");
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    window.removeEventListener("storage", this.handleStorageChange);
  }

  /**
   * Handle storage change events (multi-tab sync)
   */
  private handleStorageChange = (event: StorageEvent): void => {
    if (event.key === "access_token" && event.newValue) {
      console.log(
        "[TokenRefresh] Token updated in another tab, rescheduling..."
      );
      this.scheduleNextRefresh();
    }
  };

  /**
   * Calculate when to refresh token (2 minutes before expiry)
   * For 1h token: refreshes at 58 minutes
   */
  private getRefreshDelay(): number {
    const token = getAccessToken();
    if (!token) {
      console.log("[TokenRefresh] No token found");
      return -1;
    }

    const expiry = getTokenExpiry(token);
    if (!expiry) {
      console.log("[TokenRefresh] Cannot decode token expiry");
      return -1;
    }

    const now = Date.now();
    const expiryTime = expiry.getTime();

    // Refresh 2 minutes before expiration (120 seconds)
    const refreshBuffer = 2 * 60 * 1000; // 2 minutes in ms
    const delay = expiryTime - now - refreshBuffer;

    console.log(
      "[TokenRefresh] Token expires at:",
      expiry.toLocaleTimeString()
    );
    console.log(
      "[TokenRefresh] Will refresh in:",
      Math.round(delay / 1000),
      "seconds"
    );

    // If token expires in less than 1 minute, refresh immediately
    if (delay < 60 * 1000) {
      console.log("[TokenRefresh] Token expiring soon, refresh now");
      return 0;
    }

    return delay;
  }

  /**
   * Schedule next refresh based on token expiry
   */
  private scheduleNextRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const delay = this.getRefreshDelay();

    if (delay < 0) {
      // No valid token, stop monitoring
      console.log("[TokenRefresh] Invalid token, stopping monitor");
      return;
    }

    // Schedule refresh
    this.refreshTimer = setTimeout(() => {
      this.performRefresh();
    }, Math.max(delay, 0));

    console.log(
      "[TokenRefresh] Next refresh scheduled in",
      Math.round(delay / 1000),
      "seconds"
    );
  }

  /**
   * Perform token refresh
   */
  private async performRefresh(): Promise<void> {
    if (this.isRefreshing) {
      console.log("[TokenRefresh] Already refreshing, skip");
      return;
    }

    // Check if token is actually expired or close to expiration
    const token = getAccessToken();
    if (!token || isTokenExpired(token, 120)) {
      console.log(
        "[TokenRefresh] Token expired or expiring soon, refreshing..."
      );
    } else {
      console.log("[TokenRefresh] Token still valid, rescheduling...");
      this.scheduleNextRefresh();
      return;
    }

    this.isRefreshing = true;

    try {
      const baseURL = this.getBackendURL();
      const refreshUrl = `${baseURL}/auth/refresh`;

      console.log("[TokenRefresh] Calling refresh endpoint:", refreshUrl);

      const response = await axios.post<RefreshTokenResponse>(
        refreshUrl,
        {},
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      if (
        response.data &&
        response.data.data &&
        response.data.data.accessToken
      ) {
        const { accessToken } = response.data.data;

        console.log("[TokenRefresh] ✅ Token refreshed successfully");

        // Update token
        setAccessToken(accessToken);

        // Reset retry counter
        this.refreshAttempts = 0;

        // Notify WebSocket service to update token
        try {
          const { websocketService } = await import("./websocket.service");
          websocketService.updateToken();
        } catch (wsError) {
          console.warn(
            "[TokenRefresh] WebSocket token update failed:",
            wsError
          );
        }

        // Dispatch event for other components
        window.dispatchEvent(
          new CustomEvent("token:refreshed", {
            detail: { accessToken },
          })
        );

        // Schedule next refresh
        this.scheduleNextRefresh();
      } else {
        throw new Error("Invalid refresh response structure");
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[TokenRefresh] ❌ Refresh failed:", errorMessage);

      this.refreshAttempts++;

      // Check if it's an axios error with response
      const axiosError = error as { response?: { status?: number } };
      const responseStatus = axiosError?.response?.status;

      // If refresh token expired or max attempts reached, logout user
      if (
        responseStatus === 401 ||
        responseStatus === 403 ||
        this.refreshAttempts >= this.maxRefreshAttempts
      ) {
        console.error(
          "[TokenRefresh] Refresh token expired or max attempts reached, logging out"
        );

        clearTokens();
        this.stop();

        // Redirect to login
        window.location.href = "/login";
      } else {
        // Retry after 10 seconds
        console.log("[TokenRefresh] Retrying in 10 seconds...");
        this.refreshTimer = setTimeout(() => {
          this.performRefresh();
        }, 10000);
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Force immediate refresh (for manual trigger)
   */
  async forceRefresh(): Promise<void> {
    console.log("[TokenRefresh] Force refresh triggered");
    this.refreshAttempts = 0;
    await this.performRefresh();
  }

  /**
   * Check if currently refreshing
   */
  isCurrentlyRefreshing(): boolean {
    return this.isRefreshing;
  }
}

// Export singleton instance
export const tokenRefreshService = new TokenRefreshService();
export default tokenRefreshService;
