/**
 * Authentication service
 * Handles all authentication-related API calls
 */

import axiosInstance from "./axios.service";
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshTokenResponse,
  ApiResponse,
} from "../types";
import { setTokens, clearTokens } from "../utils/token.util";

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
  const response = await axiosInstance.post<RefreshTokenResponse>(
    "/auth/refresh",
    {},
    { withCredentials: true }
  );

  if (response.data.success && response.data.data) {
    const { accessToken } = response.data.data;
    // Persist new access token locally
    setTokens(accessToken);
  }

  return response.data;
};

/**
 * Logout user
 */
export const logout = async (): Promise<ApiResponse> => {
  try {
    // Logout endpoint clears the refresh token cookie server-side. We still call it to revoke the token in DB.
    const response = await axiosInstance.post<ApiResponse>(
      "/auth/logout",
      {},
      { withCredentials: true }
    );

    // Clear local access token
    clearTokens();

    return response.data;
  } catch (error) {
    // Even if API call fails, clear local tokens
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
