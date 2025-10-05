/**
 * Authentication related type definitions
 */

// User object returned from API
export interface User {
  id: number;
  email: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Login request payload
export interface LoginRequest {
  email: string;
  password: string;
}

// Register request payload
export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  confirmPassword?: string;
}

// Authentication response from API
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    accessToken: string;
  };
}

// Refresh token response (server returns only a new access token; refresh token remains in HttpOnly cookie)
export interface RefreshTokenResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
  };
}

// Logout does not require a refresh token in the body because server reads cookie; keep empty payload shape
export type LogoutRequest = Record<string, never>;

// API error response
export interface ApiError {
  success: false;
  message: string;
  error?: string;
}
