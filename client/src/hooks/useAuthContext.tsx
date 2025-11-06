/* eslint-disable react-refresh/only-export-components */
/**
 * Authentication context
 * Provides authentication state and methods globally
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { User } from "../types";
import {
  isAuthenticated as checkAuth,
  getCurrentUser,
} from "../services/auth.service";
import { getAccessToken } from "../utils/token.util";
import { clearTokens } from "../utils/token.util";

// Authentication context type
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
}

// Create context with undefined default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider props
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 * Wraps the app to provide auth state
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setAuthenticated] = useState<boolean>(false);
  const [isLoading, setLoading] = useState<boolean>(true);

  // Check authentication status on mount
  useEffect(() => {
    const initializeAuth = async () => {

      try {
        const rawToken = getAccessToken();
        const authenticated = checkAuth();
          "[AuthProvider] Token exists:",
          !!rawToken,
          "Authenticated:",
          authenticated
        );

        // If no token exists, skip API call
        if (!rawToken || !authenticated) {

          setAuthenticated(false);
          setUser(null);
          setLoading(false);
          return;
        }

        // We have a token - verify it with the server

        setAuthenticated(true);

        try {
          // Add timeout protection - if getCurrentUser takes more than 5 seconds, treat as failure
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), 5000);
          });

          const response = (await Promise.race([
            getCurrentUser(),
            timeoutPromise,
          ])) as any;



          if (response.success && response.data) {
            setUser(response.data);
          } else {
            // Server responded but indicated failure
            setUser(null);
          }
        } catch (getCurrentUserError: any) {
            "[AuthProvider] âŒ getCurrentUser failed:",
            getCurrentUserError
          );

          // If timeout or network error, clear the potentially invalid token
          if (
            getCurrentUserError?.message === "Request timeout" ||
            !getCurrentUserError?.response
          ) {
              "[AuthProvider] â° Request timeout or network error - clearing token"
            );
            setAuthenticated(false);
            setUser(null);
            clearTokens();
          }
          // Only clear auth state when server explicitly says token is invalid/expired
          else if (getCurrentUserError?.response?.status === 401) {

            setAuthenticated(false);
            setUser(null);
            // Clear the invalid token properly
            clearTokens();
          } else {
            setUser(null);
            // Keep isAuthenticated = true for other errors (network, etc.)
          }
        }
      } catch (error) {

        setAuthenticated(false);
        setUser(null);
      } finally {

        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    setUser,
    setAuthenticated,
    setLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to use authentication context
 * Must be used within AuthProvider
 */
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }

  return context;
};
