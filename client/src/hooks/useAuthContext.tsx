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

        if (authenticated) {
          // Since we have a token, assume authenticated until proven otherwise
          setAuthenticated(true);

          try {
            const response = await getCurrentUser();

            if (response.success && response.data) {
              setUser(response.data);
            } else {
              // Server responded but indicated failure
              setUser(null);
            }
          } catch (getCurrentUserError: any) {
            // Only clear auth state when server explicitly says token is invalid/expired
            if (getCurrentUserError?.response?.status === 401) {
              setAuthenticated(false);
              setUser(null);
              // Clear the invalid token properly
              clearTokens();
            } else {
              setUser(null);
              // Keep isAuthenticated = true for other errors (network, etc.)
            }
          }
        } else {
          setAuthenticated(false);
          setUser(null);
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
