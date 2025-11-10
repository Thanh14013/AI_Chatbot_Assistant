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
      console.log("[AuthProvider] Init");
      try {
        const rawToken = getAccessToken();
        const authenticated = checkAuth();
        console.log(
          "[AuthProvider] Token:",
          !!rawToken,
          "Auth:",
          authenticated
        );

        if (!rawToken || !authenticated) {
          console.log("[AuthProvider] No token");
          setAuthenticated(false);
          setUser(null);
          setLoading(false);
          return;
        }

        console.log("[AuthProvider] Verifying...");
        setAuthenticated(true);

        try {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), 5000);
          });

          const response = (await Promise.race([
            getCurrentUser(),
            timeoutPromise,
          ])) as any;

          console.log("[AuthProvider] Response OK");

          if (response.success && response.data) {
            setUser(response.data);
          } else {
            setUser(null);
          }
        } catch (getCurrentUserError: any) {
          console.log("[AuthProvider] Error:", getCurrentUserError);

          if (
            getCurrentUserError?.message === "Request timeout" ||
            !getCurrentUserError?.response
          ) {
            console.log("[AuthProvider] Timeout");
            setAuthenticated(false);
            setUser(null);
            clearTokens();
          } else if (getCurrentUserError?.response?.status === 401) {
            console.log("[AuthProvider] 401");
            setAuthenticated(false);
            setUser(null);
            clearTokens();
          } else {
            setUser(null);
          }
        }
      } catch (error) {
        console.log("[AuthProvider] Fatal:", error);
        setAuthenticated(false);
        setUser(null);
      } finally {
        console.log("[AuthProvider] Done");
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

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }

  return context;
};
