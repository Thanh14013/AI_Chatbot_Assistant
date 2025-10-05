/**
 * Environment configuration
 * Centralized configuration for environment variables
 */

// API base URL - uses proxy in development, can be configured for production
// Use Vite's import.meta.env instead of process.env to avoid referencing Node globals in the browser
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || "/api";

// Backend server URL for direct access
export const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) || "http://localhost:3000";

// Application environment (Vite exposes helpers)
export const IS_DEVELOPMENT = Boolean(import.meta.env.DEV);
export const IS_PRODUCTION = Boolean(import.meta.env.PROD);

// Token expiration times (in milliseconds)
const parseMs = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const ACCESS_TOKEN_EXPIRY = parseMs(
  import.meta.env.VITE_ACCESS_TOKEN_EXPIRY_MS as string | undefined,
  60 * 60 * 1000
); // 1 hour

export const REFRESH_TOKEN_EXPIRY = parseMs(
  import.meta.env.VITE_REFRESH_TOKEN_EXPIRY_MS as string | undefined,
  7 * 24 * 60 * 60 * 1000
); // 7 days

// API timeout
export const API_TIMEOUT = parseMs(
  import.meta.env.VITE_API_TIMEOUT_MS as string | undefined,
  10000
); // 10 seconds
