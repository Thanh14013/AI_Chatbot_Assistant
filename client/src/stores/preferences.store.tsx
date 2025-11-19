/**
 * User Preferences Context
 * Client-side cache for user preferences to avoid repeated API calls
 * Cache is user-specific to prevent data leakage between accounts
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  getUserPreferences,
  updateUserPreferences,
  type UserPreference,
  type UpdateUserPreferencesInput,
} from "../services/user-preference.service";
import { useAuthContext } from "../hooks/useAuthContext";

interface PreferencesContextType {
  // State
  preferences: UserPreference | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPreferences: () => Promise<void>;
  updatePreferencesCache: (
    updates: UpdateUserPreferencesInput
  ) => Promise<void>;
  clearPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined
);

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Generate cache keys with userId to prevent data leakage
 */
const getCacheKey = (userId: string | number | undefined, suffix: string) =>
  userId
    ? `user-preferences-${userId}-${suffix}`
    : `user-preferences-${suffix}`;

interface PreferencesProviderProps {
  children: ReactNode;
}

export const PreferencesProvider: React.FC<PreferencesProviderProps> = ({
  children,
}) => {
  const { user } = useAuthContext();
  const [preferences, setPreferences] = useState<UserPreference | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  // Load from localStorage on mount or when user changes
  useEffect(() => {
    if (!user?.id) {
      // No user, clear preferences
      setPreferences(null);
      setLastFetched(null);
      return;
    }

    const cached = localStorage.getItem(getCacheKey(user.id, "data"));
    const cachedTimestamp = localStorage.getItem(
      getCacheKey(user.id, "timestamp")
    );

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
          localStorage.removeItem(getCacheKey(user.id, "data"));
          localStorage.removeItem(getCacheKey(user.id, "timestamp"));
        }
      } else {
        // Cache expired
        localStorage.removeItem(getCacheKey(user.id, "data"));
        localStorage.removeItem(getCacheKey(user.id, "timestamp"));
      }
    }
  }, [user?.id]);

  // Save to localStorage when preferences change
  useEffect(() => {
    if (preferences && user?.id) {
      localStorage.setItem(
        getCacheKey(user.id, "data"),
        JSON.stringify(preferences)
      );
      if (lastFetched) {
        localStorage.setItem(
          getCacheKey(user.id, "timestamp"),
          lastFetched.toString()
        );
      }
    }
  }, [preferences, lastFetched, user?.id]);

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
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch preferences";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, preferences, shouldRefetch]);

  // Update preferences (API + cache)
  const updatePreferencesCache = useCallback(
    async (updates: UpdateUserPreferencesInput) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await updateUserPreferences(updates);

        if (response.success && response.data) {
          setPreferences(response.data);
          setLastFetched(Date.now());
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update preferences";
        setError(errorMessage);
        throw err; // Re-throw for UI to handle
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Clear preferences (on logout)
  const clearPreferences = useCallback(() => {
    setPreferences(null);
    setLastFetched(null);
    setError(null);

    // Clear all user-preferences cache entries (for all users)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("user-preferences-")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }, []);

  const value: PreferencesContextType = {
    preferences,
    isLoading,
    error,
    fetchPreferences,
    updatePreferencesCache,
    clearPreferences,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

// Custom hook to use preferences
export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
};
