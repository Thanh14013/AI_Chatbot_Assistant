/**
 * Axios instance configuration with interceptors
 * Handles automatic token attachment and refresh logic
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import {
  getAccessToken,
  setAccessToken,
  clearTokens,
  isTokenExpired,
  getTokenExpiry,
} from "../utils/token.util";
import { websocketService } from "./websocket.service";
import type { ApiErrorResponse, RefreshTokenResponse } from "../types";

// Determine the base URL based on environment
// In development: use /api (Vite proxy will forward to backend)
// In production: use full backend URL from .env
const getBaseURL = (): string => {
  const isDevelopment = import.meta.env.DEV;
  const apiBasePath = import.meta.env.VITE_API_BASE_URL || "/api";

  if (isDevelopment) {
    // Use relative path in development to utilize Vite's proxy
    return apiBasePath;
  } else {
    // Use full URL in production - MUST use VITE_BACKEND_URL from .env
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    if (!backendUrl) {
      console.error("VITE_BACKEND_URL is not set in .env file!");
      throw new Error("Backend URL is required in production");
    }
    return `${backendUrl}${apiBasePath}`;
  }
};

// Create axios instance with base configuration
const axiosInstance = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  // Include cookies (HttpOnly refresh token) on requests to the API
  withCredentials: true,
});

// Flag to prevent multiple refresh token requests
let isRefreshing = false;
// Queue for failed requests during token refresh
let failedRequestsQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

/**
 * Process queued requests after token refresh
 */
const processQueue = (
  error: unknown = null,
  token: string | null = null
): void => {
  failedRequestsQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedRequestsQueue = [];
};

/**
 * Request interceptor
 * Attaches access token to every request
 */
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();

    // Log token state in development
    if (import.meta.env.DEV && token) {
      const expired = isTokenExpired(token);
      const expiry = getTokenExpiry(token);
      // Development logging only
      if (import.meta.env.DEV) {
        console.log("[Axios Request] Token state:", {
          url: config.url,
          hasToken: !!token,
          expired,
          expiresAt: expiry?.toISOString(),
          timeUntilExpiry: expiry
            ? Math.round((expiry.getTime() - Date.now()) / 1000) + "s"
            : "N/A",
        });
      }
    }

    // Attach token to Authorization header if available
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach socket ID to exclude sender from broadcasts
    const socketId = websocketService.getSocketId();
    if (socketId && config.headers) {
      config.headers["x-socket-id"] = socketId;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor
 * Handles 401 errors and automatic token refresh
 */
axiosInstance.interceptors.response.use(
  // Success response - pass through
  (response) => {
    return response;
  },

  // Error response handler
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Log errors in development for debugging
    if (import.meta.env.DEV) {
      console.log("[Axios Interceptor] Error caught:", {
        status: error.response?.status,
        url: originalRequest?.url,
        message: error.response?.data?.message,
        retry: originalRequest?._retry,
      });
    }

    // Handle 401 Unauthorized errors
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      const url = originalRequest.url || "";

      // If the 401 came from authentication endpoints (login/register),
      // don't attempt a token refresh or redirect — let the caller handle the error.
      if (url.includes("/auth/login") || url.includes("/auth/register")) {
        if (import.meta.env.DEV) {
          console.log("[Axios Interceptor] Auth endpoint failed, not retrying");
        }
        return Promise.reject(error);
      }

      // If /auth/me fails, just reject without trying to refresh
      // This handles the case when user has no token yet
      if (url.includes("/auth/me")) {
        if (import.meta.env.DEV) {
          console.log("[Axios Interceptor] /auth/me failed, not retrying");
        }
        return Promise.reject(error);
      }

      // If refresh endpoint fails, logout user (token expired or invalid)
      if (url.includes("/auth/refresh")) {
        if (import.meta.env.DEV) {
          console.log(
            "[Axios Interceptor] Refresh endpoint failed, logging out"
          );
        }
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (import.meta.env.DEV) {
        console.log(
          "[Axios Interceptor] Access token expired, attempting refresh..."
        );
      }

      // Mark request as retry to prevent infinite loops
      originalRequest._retry = true;

      // If already refreshing, queue this request
      if (isRefreshing) {
        if (import.meta.env.DEV) {
          console.log(
            "[Axios Interceptor] Already refreshing, queueing request"
          );
        }
        return new Promise((resolve, reject) => {
          failedRequestsQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(axiosInstance(originalRequest));
            },
            reject: (err: unknown) => {
              reject(err);
            },
          });
        });
      }

      // Start token refresh process
      isRefreshing = true;

      if (import.meta.env.DEV) {
        console.log("[Axios Interceptor] Starting token refresh...");
      }

      try {
        // Use the same base URL as axiosInstance to ensure consistency
        const baseURL = getBaseURL();
        const refreshUrl = `${baseURL}/auth/refresh`;

        if (import.meta.env.DEV) {
          console.log("[Axios Interceptor] Refresh URL:", refreshUrl);
        }

        const response = await axios.post<RefreshTokenResponse>(
          refreshUrl,
          {},
          {
            withCredentials: true,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (import.meta.env.DEV) {
          console.log("[Axios Interceptor] Refresh response:", response.data);
        }

        // Safely extract access token with validation
        if (
          !response.data ||
          !response.data.data ||
          !response.data.data.accessToken
        ) {
          console.error(
            "[Axios Interceptor] Invalid refresh token response structure:",
            response.data
          );
          throw new Error("Invalid refresh token response structure");
        }

        const { accessToken } = response.data.data;

        if (import.meta.env.DEV) {
          console.log(
            "[Axios Interceptor] New access token received, updating..."
          );
        }

        // Persist new access token locally
        setAccessToken(accessToken);

        // Tell WebSocket service to reconnect using the new token (if connected)
        try {
          websocketService.updateToken();
        } catch {
          // Non-fatal: websocket token update failed
        }

        // Update Authorization header for the original request
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        // Resume queued requests
        processQueue(null, accessToken);

        if (import.meta.env.DEV) {
          console.log(
            "[Axios Interceptor] Retrying original request with new token"
          );
        }

        // Retry original request
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        console.error(
          "[Axios Interceptor] Token refresh failed:",
          refreshError
        );

        processQueue(refreshError, null);

        // Only clear tokens and redirect if it's a 401/403 (authentication failure)
        if (axios.isAxiosError(refreshError)) {
          if (
            refreshError.response?.status === 401 ||
            refreshError.response?.status === 403
          ) {
            clearTokens();
            window.location.href = "/login";
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // For other errors, reject as-is
    return Promise.reject(error);
  }
);

export default axiosInstance;
