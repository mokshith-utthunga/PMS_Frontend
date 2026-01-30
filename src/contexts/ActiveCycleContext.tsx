// Active Cycle Context - Fetches and caches active cycle data once at app initialization
import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cycleService } from '@/services';
import type { ActiveCycleResponse } from '@/services/cycle.service';
import { useAuth } from './AuthContext';
import { saveToLocalStorage, loadFromLocalStorage } from '@/utils/localStorageCache';
import { CACHE_STALE_TIME, CACHE_GC_TIME } from '@/utils/constants';

interface ActiveCycleContextType {
  activeCycle: ActiveCycleResponse['data'] | null;
  quarterlyCycles: ActiveCycleResponse['quarterly_cycles'] | undefined;
  goalsQuarterlyCycles: ActiveCycleResponse['goals_quarterly_cycles'] | undefined;
  dashboard: ActiveCycleResponse['dashboard'] | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

const ActiveCycleContext = createContext<ActiveCycleContextType | undefined>(undefined);

export function ActiveCycleProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const cacheKey = user?.id ? `active-cycle-${user.id}` : null;
  
  const {
    data: activeCycleData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['active-cycle', user?.id], 
    queryFn: async () => {
      const result = await cycleService.getActive();
      
      if (cacheKey) {
        saveToLocalStorage(cacheKey, result);
      }
      
      return result;
    },
    enabled: !!user && !authLoading, 
    staleTime: CACHE_STALE_TIME, 
    gcTime: CACHE_GC_TIME, 
    refetchOnWindowFocus: true, 
    refetchOnMount: true, 
    refetchOnReconnect: true, 
    initialData: () => {
      if (!cacheKey) return undefined;
      const cachedData = loadFromLocalStorage<ActiveCycleResponse>(cacheKey);
      return cachedData || undefined;
    },
  });

  // Always provide a value, even during initialization
  // Use useMemo to ensure stable reference
  const value: ActiveCycleContextType = useMemo(() => ({
    activeCycle: activeCycleData?.data || null,
    quarterlyCycles: activeCycleData?.quarterly_cycles,
    goalsQuarterlyCycles: activeCycleData?.goals_quarterly_cycles,
    dashboard: activeCycleData?.dashboard || null,
    isLoading: isLoading || authLoading, // Include auth loading state
    isError,
    error: error as Error | null,
    refetch: () => {
      refetch();
    },
  }), [activeCycleData, isLoading, authLoading, isError, error, refetch]);

  // Always render the provider, even if data is loading
  return (
    <ActiveCycleContext.Provider value={value}>
      {children}
    </ActiveCycleContext.Provider>
  );
}

export function useActiveCycle() {
  const context = useContext(ActiveCycleContext);
  if (context === undefined) {
    throw new Error('useActiveCycle must be used within an ActiveCycleProvider');
  }
  return context;
}
