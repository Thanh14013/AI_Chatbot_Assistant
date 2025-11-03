/**
 * Authentication service
 * Handles all authentication-related API calls
 */

import axiosInstance from "./axios.service";
import axios from "axios";
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshTokenResponse,
  ApiResponse,
  GetCurrentUserResponse,
} from "../types";
import { setTokens, clearTokens } from "../utils/token.util";
import { websocketService } from "./websocket.service";

/**
 * Register a new user
 */

export const register = async (
  data: RegisterRequest
): Promise<AuthResponse> => {
  const response = await axiosInstance.post<AuthResponse>(
    "/auth/register",
    data
  );

  // Note: server currently does not return tokens after registration.
  // The client will redirect user to the login page after successful registration.

  return response.data;
};

/**
 * Login user
 */
export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await axiosInstance.post<AuthResponse>("/auth/login", data);

  // Save tokens after successful login
  if (response.data.success && response.data.data) {
    const { accessToken } = response.data.data;
    // Server sets refresh token in HttpOnly cookie. Save access token locally.
    setTokens(accessToken);
  }

  return response.data;
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (): Promise<RefreshTokenResponse> => {
  // Call refresh endpoint without body. Server reads refresh token from HttpOnly cookie and returns new access token.
  // Use the plain axios client here to avoid triggering axiosInstance interceptors
  // (which may attempt to refresh again and cause recursion). The plain axios
  // call still sends cookies when withCredentials is true.
  const refreshUrl = `/api/auth/refresh`;
  const response = await axios.post<RefreshTokenResponse>(
    refreshUrl,
    {},
    { withCredentials: true }
  );

  if (response.data.success && response.data.data) {
    const { accessToken } = response.data.data;
    // Persist new access token locally
    setTokens(accessToken);

    // If a WebSocket connection exists, tell it to reconnect with the new token
    try {
      websocketService.updateToken();
    } catch {
      // Removed console.error logging for websocket updates
    }
  }

  return response.data;
};

/**
 * Logout user
 */
export const logout = async (): Promise<ApiResponse> => {
  try {
    const response = await axiosInstance.post<ApiResponse>(
      "/auth/logout",
      {},
      { withCredentials: true }
    );

    clearTokens();

    return response.data;
  } catch (error) {
    clearTokens();
    throw error;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  // Refresh token is stored in HttpOnly cookie; check access token stored locally instead
  const accessToken =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return !!accessToken;
};

/**
 * Get current user
 */
export const getCurrentUser = async (): Promise<GetCurrentUserResponse> => {
  const response = await axiosInstance.get<GetCurrentUserResponse>("/auth/me");

  return response.data;
};
