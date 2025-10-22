/**
 * Axios instance configuration with interceptors
 * Handles automatic token attachment and refresh logic
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import {
  getAccessToken,
  setAccessToken,
  clearTokens,
} from "../utils/token.util";
import { websocketService } from "./websocket.service";
import type { ApiErrorResponse, RefreshTokenResponse } from "../types";

// Create axios instance with base configuration
const axiosInstance = axios.create({
  baseURL: "/api",
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

    // Attach token to Authorization header if available
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
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
    // no debug logs

    return response;
  },

  // Error response handler
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized errors
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      // If the 401 came from authentication endpoints (login/register),
      // don't attempt a token refresh or redirect — let the caller handle the error.
      const url = originalRequest.url || "";
      if (url.includes("/auth/login") || url.includes("/auth/register")) {
        return Promise.reject(error);
      }

      // If refresh endpoint fails, logout user (token expired or invalid)
      if (originalRequest.url?.includes("/auth/refresh")) {
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      // Mark request as retry to prevent infinite loops
      originalRequest._retry = true;

      // If already refreshing, queue this request
      if (isRefreshing) {
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

      // Start token refresh process. The server stores the refresh token in an HttpOnly cookie.
      isRefreshing = true;
      try {
        // POST to refresh endpoint without body. Browser will send cookie automatically because
        // axiosInstance was created with withCredentials: true. Use plain axios to avoid interceptor recursion.
        // Use the same proxy path as axiosInstance baseURL to ensure consistency
        const refreshUrl = "/api/auth/refresh";
        const response = await axios.post<RefreshTokenResponse>(
          refreshUrl,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data.data;

        // Persist new access token locally
        setAccessToken(accessToken);

        // Tell WebSocket service to reconnect using the new token (if connected)
        try {
          websocketService.updateToken();
        } catch {
          // Non-fatal: websocket token update failed (log suppressed)
        }

        // Update Authorization header for the original request
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        // Resume queued requests
        processQueue(null, accessToken);

        // Retry original request
        return axiosInstance(originalRequest);
      } catch (refreshError) {
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
