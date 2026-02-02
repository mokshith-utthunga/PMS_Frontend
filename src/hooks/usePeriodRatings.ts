// Custom hook for period ratings
import { useState, useEffect, useCallback, useMemo } from 'react';
import { evaluationService } from '@/services/evaluation.service';
import { logError } from '@/errors';
import type { PeriodType } from '@/services/transition.service';

export interface PeriodRating {
  id: string;
  employee_id: string;
  cycle_id: string;
  quarter: number;
  transition_id?: string | null;
  period_type: PeriodType;
  period_start_date: string;
  period_end_date: string;
  period_days: number;
  weighted_avg_rating: number | null;
  manager_id?: string | null;
  is_final: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinalQuarterlyRating {
  id: string;
  employee_id: string;
  cycle_id: string;
  quarter: number;
  transition_id?: string | null;
  pre_transition_rating: number | null;
  post_transition_rating: number | null;
  pre_transition_days: number | null;
  post_transition_days: number | null;
  final_quarterly_rating: number;
  calculation_method: 'simple_average' | 'time_weighted';
  is_final: boolean;
  calculated_at: string;
  calculated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsePeriodRatingsOptions {
  employeeId: string | undefined;
  cycleId: string | undefined;
  quarter?: number | null;
  periodType?: PeriodType | null;
  enabled?: boolean;
}

export interface UsePeriodRatingsResult {
  periodRatings: PeriodRating[];
  preTransitionRating: PeriodRating | null;
  postTransitionRating: PeriodRating | null;
  finalRating: FinalQuarterlyRating | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  calculateFinal: (useTimeWeighted?: boolean) => Promise<FinalQuarterlyRating | null>;
}

/**
 * Hook to fetch period ratings
 * Uses useMemo and useCallback for performance optimization
 */
export function usePeriodRatings(options: UsePeriodRatingsOptions): UsePeriodRatingsResult {
  const { employeeId, cycleId, quarter, periodType, enabled = true } = options;
  
  const [periodRatings, setPeriodRatings] = useState<PeriodRating[]>([]);
  const [finalRating, setFinalRating] = useState<FinalQuarterlyRating | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPeriodRatings = useCallback(async () => {
    if (!employeeId || !cycleId || !enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await evaluationService.periodRatings.get(employeeId, cycleId, quarter || undefined, periodType || undefined);
      
      setPeriodRatings(result.data || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch period ratings');
      logError(error, 'usePeriodRatings');
      setError(error);
      setPeriodRatings([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, cycleId, quarter, periodType, enabled]);

  const calculateFinal = useCallback(async (useTimeWeighted = false): Promise<FinalQuarterlyRating | null> => {
    if (!employeeId || !cycleId || !quarter) {
      return null;
    }

    try {
      const result = await evaluationService.periodRatings.calculateFinal(
        employeeId,
        cycleId,
        quarter,
        useTimeWeighted
      );
      
      setFinalRating(result.data || null);
      return result.data || null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to calculate final rating');
      logError(error, 'usePeriodRatings.calculateFinal');
      throw error;
    }
  }, [employeeId, cycleId, quarter]);

  useEffect(() => {
    fetchPeriodRatings();
  }, [fetchPeriodRatings]);

  // Memoize derived data
  const preTransitionRating = useMemo(() => 
    periodRatings.find(r => r.period_type === 'pre_transition') || null,
    [periodRatings]
  );

  const postTransitionRating = useMemo(() => 
    periodRatings.find(r => r.period_type === 'post_transition') || null,
    [periodRatings]
  );

  // Memoize result to prevent unnecessary re-renders
  return useMemo(() => ({
    periodRatings,
    preTransitionRating,
    postTransitionRating,
    finalRating,
    loading,
    error,
    refetch: fetchPeriodRatings,
    calculateFinal,
  }), [periodRatings, preTransitionRating, postTransitionRating, finalRating, loading, error, fetchPeriodRatings, calculateFinal]);
}
