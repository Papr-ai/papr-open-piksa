'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { UserContextData } from '@/lib/ai/memory/user-context';

interface UserContextProviderState {
  userContext: UserContextData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refreshUserContext: () => Promise<void>;
}

const UserContextContext = createContext<UserContextProviderState | undefined>(undefined);

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = 'papr_user_context';
const STORAGE_TIMESTAMP_KEY = 'papr_user_context_timestamp';

export function UserContextProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [userContext, setUserContext] = useState<UserContextData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Load cached context from localStorage
  const loadCachedContext = useCallback(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      const timestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
      
      if (cached && timestamp) {
        const cacheAge = Date.now() - parseInt(timestamp);
        if (cacheAge < CACHE_DURATION) {
          console.log('[UserContext] Loading cached user context (age:', Math.round(cacheAge / 1000), 'seconds)');
          const parsedContext = JSON.parse(cached) as UserContextData;
          setUserContext(parsedContext);
          setLastUpdated(parseInt(timestamp));
          return true;
        } else {
          console.log('[UserContext] Cached context expired, will fetch fresh');
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
        }
      }
    } catch (error) {
      console.error('[UserContext] Error loading cached context:', error);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
    }
    return false;
  }, []);

  // Fetch fresh user context from API
  const fetchUserContext = useCallback(async (): Promise<UserContextData | null> => {
    try {
      console.log('[UserContext] Fetching fresh user context from API...');
      const response = await fetch('/api/user/context');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user context: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        return data.userContext;
      } else {
        throw new Error(data.error || 'Unknown error fetching user context');
      }
    } catch (error) {
      console.error('[UserContext] Error fetching user context:', error);
      throw error;
    }
  }, []);

  // Refresh user context (public method)
  const refreshUserContext = useCallback(async () => {
    if (!session?.user?.id || isLoading) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const freshContext = await fetchUserContext();
      
      if (freshContext) {
        setUserContext(freshContext);
        const timestamp = Date.now();
        setLastUpdated(timestamp);
        
        // Cache in localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(freshContext));
        localStorage.setItem(STORAGE_TIMESTAMP_KEY, timestamp.toString());
        
        console.log('[UserContext] ✅ User context refreshed and cached');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      console.error('[UserContext] Failed to refresh user context:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, isLoading, fetchUserContext]);

  // Initialize user context on app load
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user?.id) {
      // Clear context for unauthenticated users
      setUserContext(null);
      setLastUpdated(null);
      setError(null);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
      return;
    }

    // Try to load cached context first
    const hasCachedContext = loadCachedContext();
    
    // If no cached context or cache is expired, fetch fresh
    if (!hasCachedContext && !isLoading) {
      console.log('[UserContext] No cached context found, fetching fresh...');
      refreshUserContext();
    }
  }, [session?.user?.id, status, loadCachedContext, refreshUserContext, isLoading]);

  const value: UserContextProviderState = {
    userContext,
    isLoading,
    error,
    lastUpdated,
    refreshUserContext
  };

  return (
    <UserContextContext.Provider value={value}>
      {children}
    </UserContextContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContextContext);
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserContextProvider');
  }
  return context;
}

// Helper hook to get context string for AI prompts
export function useUserContextString(): string {
  const { userContext } = useUserContext();
  return userContext?.context || '';
}

// Helper hook to check if context is available
export function useHasUserContext(): boolean {
  const { userContext, isLoading } = useUserContext();
  return !isLoading && !!userContext?.context;
}

