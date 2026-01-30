// Hook to fetch and cache current employee data using React Query
// This ensures the API is only called once and cached for all components
import { useQuery } from '@tanstack/react-query';
import { employeeService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { saveToLocalStorage, loadFromLocalStorage } from '@/utils/localStorageCache';
import { CACHE_STALE_TIME, CACHE_GC_TIME } from '@/utils/constants';
import type { Employee } from '@/types';

export function useCurrentEmployee() {
  const { user } = useAuth();
  const cacheKey = user?.id ? `current-employee-${user.id}` : 'current-employee';

  const {
    data: employeeData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['current-employee', user?.id], // Include user.id to make cache user-specific
    queryFn: async () => {
      const result = await employeeService.getMe();
      const employee = result.data;
      
      // Persist to localStorage to survive page refreshes
      if (employee) {
        saveToLocalStorage(cacheKey, employee);
      }
      
      return employee;
    },
    enabled: !!user, // Only fetch when user is authenticated
    staleTime: CACHE_STALE_TIME, // Data is fresh for this duration, then becomes stale
    gcTime: CACHE_GC_TIME, // Keep in cache for this duration after last use
    refetchOnWindowFocus: true, // Refetch on window focus if data is stale
    refetchOnMount: true, // Refetch on component mount if data is stale
    refetchOnReconnect: true, // Refetch on reconnect if data is stale
    // Use initialData from localStorage if available (for page refresh)
    initialData: () => {
      const cachedEmployee = loadFromLocalStorage<Employee>(cacheKey);
      return cachedEmployee || undefined;
    },
  });

  return {
    employee: employeeData || null,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
