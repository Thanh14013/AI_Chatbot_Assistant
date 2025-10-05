/**
 * Authentication hook
 * Provides authentication methods and state
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "./useAuthContext";
import type { LoginRequest, RegisterRequest } from "../types";
import * as authService from "../services/auth.service";

/**
 * Custom hook for authentication operations
 */
export const useAuth = () => {
  const navigate = useNavigate();
  const {
    user,
    isAuthenticated,
    isLoading,
    setUser,
    setAuthenticated,
    setLoading,
  } = useAuthContext();

  /**
   * Login user
   */
  const login = useCallback(
    async (credentials: LoginRequest) => {
      setLoading(true);
      try {
        const response = await authService.login(credentials);

        if (response.success && response.data) {
          setUser(response.data.user);
          setAuthenticated(true);
          navigate("/"); // Redirect to home after login
        }

        return response;
      } catch (error) {
        setAuthenticated(false);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [navigate, setUser, setAuthenticated, setLoading]
  );

  /**
   * Register new user
   */
  const register = useCallback(
    async (data: RegisterRequest) => {
      setLoading(true);
      try {
        const response = await authService.register(data);

        // Server returns only a success message on registration (no tokens).
        // Redirect user to login so they can authenticate manually.
        if (response.success) {
          navigate("/login");
        }

        return response;
      } catch (error) {
        setAuthenticated(false);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [navigate, setAuthenticated, setLoading]
  );

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setAuthenticated(false);
      navigate("/login"); // Redirect to login after logout
    } catch (error) {
      // Even if API call fails, clear local state
      setUser(null);
      setAuthenticated(false);
      navigate("/login");
      throw error;
    } finally {
      setLoading(false);
    }
  }, [navigate, setUser, setAuthenticated, setLoading]);

  /**
   * Refresh access token
   */
  const refreshToken = useCallback(async () => {
    try {
      await authService.refreshAccessToken();
      return true;
    } catch {
      setUser(null);
      setAuthenticated(false);
      return false;
    }
  }, [setUser, setAuthenticated]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
  };
};
