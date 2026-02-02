// Custom hook for employee transitions
import { useState, useEffect, useCallback, useMemo } from 'react';
import { transitionService } from '@/services/transition.service';
import { logError } from '@/errors';
import type { EmployeeQuarterTransition } from '@/services/transition.service';

export interface UseTransitionOptions {
  employeeId: string | undefined;
  cycleId?: string | null;
  quarter?: number | null;
  enabled?: boolean;
}

export interface UseTransitionResult {
  transition: EmployeeQuarterTransition | null;
  transitions: EmployeeQuarterTransition[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch employee transitions
 * Uses useMemo and useCallback for performance optimization
 */
export function useTransition(options: UseTransitionOptions): UseTransitionResult {
  const { employeeId, cycleId, quarter, enabled = true } = options;
  
  const [transition, setTransition] = useState<EmployeeQuarterTransition | null>(null);
  const [transitions, setTransitions] = useState<EmployeeQuarterTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransitions = useCallback(async () => {
    if (!employeeId || !enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await transitionService.getByEmployee(employeeId, cycleId || null, quarter || null);
      
      setTransitions(result);
      
      // If quarter is specified, get the specific transition for that quarter
      if (quarter && result.length > 0) {
        const quarterTransition = result.find(t => t.quarter === quarter);
        setTransition(quarterTransition || null);
      } else {
        setTransition(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch transitions');
      logError(error, 'useTransition');
      setError(error);
      setTransitions([]);
      setTransition(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId, cycleId, quarter, enabled]);

  useEffect(() => {
    fetchTransitions();
  }, [fetchTransitions]);

  // Memoize result to prevent unnecessary re-renders
  return useMemo(() => ({
    transition,
    transitions,
    loading,
    error,
    refetch: fetchTransitions,
  }), [transition, transitions, loading, error, fetchTransitions]);
}

/**
 * Hook to check if employee has transition for a quarter
 */
export function useHasTransition(employeeId: string | undefined, cycleId: string | undefined, quarter: number | undefined): boolean {
  const { transition } = useTransition({
    employeeId,
    cycleId,
    quarter,
    enabled: !!employeeId && !!cycleId && !!quarter,
  });

  return useMemo(() => !!transition, [transition]);
}
