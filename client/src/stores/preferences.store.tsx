/**
 * User Preferences Context
 * Client-side cache for user preferences to avoid repeated API calls
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  getUserPreferences,
  updateUserPreferences,
  type UserPreference,
  type UpdateUserPreferencesInput,
} from "../services/user-preference.service";

interface PreferencesContextType {
  // State
  preferences: UserPreference | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPreferences: () => Promise<void>;
  updatePreferencesCache: (updates: UpdateUserPreferencesInput) => Promise<void>;
  clearPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

interface PreferencesProviderProps {
  children: ReactNode;
}

export const PreferencesProvider: React.FC<PreferencesProviderProps> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreference | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const cached = localStorage.getItem("user-preferences");
    const cachedTimestamp = localStorage.getItem("user-preferences-timestamp");

    if (cached && cachedTimestamp) {
      const timestamp = parseInt(cachedTimestamp, 10);
      const age = Date.now() - timestamp;

      // Use cache if less than 5 minutes old
      if (age < CACHE_DURATION) {
        try {
          const parsedPreferences = JSON.parse(cached);
          setPreferences(parsedPreferences);
          setLastFetched(timestamp);
        } catch (err) {
          console.error("❌ [PREFERENCES] Error parsing cached preferences:", err);
          localStorage.removeItem("user-preferences");
          localStorage.removeItem("user-preferences-timestamp");
        }
      } else {
        // Cache expired
        localStorage.removeItem("user-preferences");
        localStorage.removeItem("user-preferences-timestamp");
      }
    }
  }, []);

  // Save to localStorage when preferences change
  useEffect(() => {
    if (preferences) {
      localStorage.setItem("user-preferences", JSON.stringify(preferences));
      if (lastFetched) {
        localStorage.setItem("user-preferences-timestamp", lastFetched.toString());
      }
    }
  }, [preferences, lastFetched]);

  // Check if should refetch
  const shouldRefetch = useCallback(() => {
    if (!lastFetched) return true;
    return Date.now() - lastFetched > CACHE_DURATION;
  }, [lastFetched]);

  // Fetch preferences from API
  const fetchPreferences = useCallback(async () => {
    // Don't fetch if already loading
    if (isLoading) {
      return;
    }

    // Don't fetch if cache is still valid
    if (preferences && !shouldRefetch()) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await getUserPreferences();

      if (response.success && response.data) {
        setPreferences(response.data);
        setLastFetched(Date.now());
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch preferences";
      console.error("❌ [PREFERENCES] Error:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, preferences, shouldRefetch]);

  // Update preferences (API + cache)
  const updatePreferencesCache = useCallback(async (updates: UpdateUserPreferencesInput) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await updateUserPreferences(updates);

      if (response.success && response.data) {
        setPreferences(response.data);
        setLastFetched(Date.now());
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update preferences";
      console.error("❌ [PREFERENCES] Error:", errorMessage);
      setError(errorMessage);
      throw err; // Re-throw for UI to handle
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear preferences (on logout)
  const clearPreferences = useCallback(() => {
    setPreferences(null);
    setLastFetched(null);
    setError(null);
    localStorage.removeItem("user-preferences");
    localStorage.removeItem("user-preferences-timestamp");
  }, []);

  const value: PreferencesContextType = {
    preferences,
    isLoading,
    error,
    fetchPreferences,
    updatePreferencesCache,
    clearPreferences,
  };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

// Custom hook to use preferences
export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
};
