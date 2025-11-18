/* eslint-disable react-refresh/only-export-components */
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
import { tokenRefreshService } from "../services/token-refresh.service";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setAuthenticated] = useState<boolean>(false);
  const [isLoading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const rawToken = getAccessToken();
        const authenticated = checkAuth();

        if (!rawToken || !authenticated) {
          setAuthenticated(false);
          setUser(null);
          setLoading(false);
          return;
        }

        setAuthenticated(true);

        try {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), 5000);
          });

          const response = (await Promise.race([
            getCurrentUser(),
            timeoutPromise,
          ])) as any;

          if (response.success && response.data) {
            setUser(response.data);

            // 🔥 CRITICAL FIX: Start automatic token refresh monitor
            // Prevents UI freeze after 30 minutes of inactivity
            tokenRefreshService.start();
          } else {
            setUser(null);
          }
        } catch (getCurrentUserError: any) {
          if (
            getCurrentUserError?.message === "Request timeout" ||
            !getCurrentUserError?.response
          ) {
            setAuthenticated(false);
            setUser(null);
            clearTokens();
          } else if (getCurrentUserError?.response?.status === 401) {
            setAuthenticated(false);
            setUser(null);
            clearTokens();
            tokenRefreshService.stop();
          } else {
            setUser(null);
          }
        }
      } catch (error) {
        console.error("[AuthProvider] Fatal error:", error);
        setAuthenticated(false);
        setUser(null);
        tokenRefreshService.stop();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // 🔥 CRITICAL FIX: Stop token refresh on unmount (logout)
    return () => {
      tokenRefreshService.stop();
    };
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

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }

  return context;
};
