/**
 * Environment configuration
 * Centralized configuration for environment variables
 */

// API base URL - uses proxy in development, can be configured for production
export const API_BASE_URL = process.env.VITE_API_BASE_URL || "/api";

// Backend server URL for direct access
export const BACKEND_URL =
  process.env.VITE_BACKEND_URL || "http://localhost:3000";

// Application environment
export const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Token expiration times (in milliseconds)
const parseMs = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const ACCESS_TOKEN_EXPIRY = parseMs(
  process.env.VITE_ACCESS_TOKEN_EXPIRY_MS,
  60 * 60 * 1000
); // 1 hour

export const REFRESH_TOKEN_EXPIRY = parseMs(
  process.env.VITE_REFRESH_TOKEN_EXPIRY_MS,
  7 * 24 * 60 * 60 * 1000
); // 7 days

// API timeout
export const API_TIMEOUT = parseMs(process.env.VITE_API_TIMEOUT_MS, 10000); // 10 seconds
