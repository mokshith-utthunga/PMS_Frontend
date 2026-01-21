// Hook for URL-based quarter handling
// Ensures quarter is always read from URL query params
import { useSearchParams } from 'react-router-dom';
import { useMemo, useCallback } from 'react';

export type Quarter = 1 | 2 | 3 | 4;

/**
 * Hook to get and set quarter from URL query params
 * URL is the single source of truth for quarter selection
 */
export function useQuarterFromUrl(): {
  quarter: Quarter | null;
  quarterParam: string | null;
  setQuarter: (quarter: Quarter | null) => void;
  isValidQuarter: boolean;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  const quarterParam = searchParams.get('quarter');
  
  // Parse quarter from URL (q1, q2, q3, q4)
  const quarter = useMemo<Quarter | null>(() => {
    if (!quarterParam) return null;
    const normalized = quarterParam.toLowerCase().trim();
    if (normalized === 'q1' || normalized === '1') return 1;
    if (normalized === 'q2' || normalized === '2') return 2;
    if (normalized === 'q3' || normalized === '3') return 3;
    if (normalized === 'q4' || normalized === '4') return 4;
    return null;
  }, [quarterParam]);

  const isValidQuarter = quarter !== null;

  const setQuarter = useCallback((newQuarter: Quarter | null) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newQuarter === null) {
        newParams.delete('quarter');
      } else {
        newParams.set('quarter', `q${newQuarter}`);
      }
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  return {
    quarter,
    quarterParam,
    setQuarter,
    isValidQuarter,
  };
}
