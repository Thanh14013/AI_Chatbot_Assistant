/**
 * Token storage utility functions
 * Handles storing and retrieving JWT tokens from localStorage
 */

// Storage key for access token only. Refresh token is stored as an HttpOnly cookie by the server.
const ACCESS_TOKEN_KEY = "access_token";

/**
 * Save access token to localStorage
 * The refresh token is intentionally not stored in JS (it's an HttpOnly cookie set by the server).
 */
export const setAccessToken = (token: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
};

/**
 * Get access token from localStorage
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

/**
 * Remove access token from localStorage
 */
export const removeAccessToken = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
};

/**
 * setTokens kept for compatibility but will only persist the access token.
 * The server issues the refresh token in an HttpOnly cookie; do not attempt to store it in JS.
 */
export const setTokens = (
  accessToken: string,
  _refreshToken?: string
): void => {
  // Keep signature compatible with previous implementation. The refresh token is stored in an HttpOnly cookie.
  // Use a noop reference to avoid unused parameter lint warnings.
  void _refreshToken;
  setAccessToken(accessToken);
};

/**
 * Clear stored tokens and user-specific cached data.
 * This clears the access token and all user-specific cache entries.
 * The server-side refresh cookie must be cleared by calling the logout endpoint.
 */
export const clearTokens = (): void => {
  removeAccessToken();

  // Clear all user-specific cached data to prevent data leakage between users
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.startsWith("newChatSuggestionsCache") ||
        key.startsWith("user-preferences-") ||
        key.startsWith("user_") ||
        key.startsWith("preferences_") ||
        key.startsWith("settings_"))
    ) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
};

/**
 * Check if user has an access token stored locally
 */
export const hasTokens = (): boolean => {
  return !!getAccessToken();
};

/**
 * Decode JWT token payload without verification (for client-side inspection only)
 * Returns null if token is invalid
 */
export const decodeToken = (token: string): any | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
};

/**
 * Check if access token is expired or about to expire
 * Returns true if token is expired or will expire within bufferSeconds
 */
export const isTokenExpired = (
  token: string | null,
  bufferSeconds: number = 30
): boolean => {
  if (!token) return true;

  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;

  const expiryTime = decoded.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  const bufferMs = bufferSeconds * 1000;

  return expiryTime - now < bufferMs;
};

/**
 * Get token expiry time as Date object
 */
export const getTokenExpiry = (token: string | null): Date | null => {
  if (!token) return null;

  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return null;

  return new Date(decoded.exp * 1000);
};
