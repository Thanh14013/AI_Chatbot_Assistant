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
 * Clear stored tokens. This only clears the access token; the server-side refresh cookie must be cleared by calling the logout endpoint.
 */
export const clearTokens = (): void => {
  removeAccessToken();
};

/**
 * Check if user has an access token stored locally
 */
export const hasTokens = (): boolean => {
  return !!getAccessToken();
};
