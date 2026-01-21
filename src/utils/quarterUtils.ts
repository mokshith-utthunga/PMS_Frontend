// Quarter timing and status utilities
import type { PerformanceCycle } from '@/types';

export type QuarterTiming = 'future' | 'current' | 'past';
export type QuarterStatus = 'submitted' | 'in_progress' | 'pending' | 'not_started';

export function isQuarterOpen(cycle: PerformanceCycle | null, quarter: number): boolean {
  if (!cycle) return false;
  
  const startField = `q${quarter}_self_review_start` as keyof PerformanceCycle;
  const endField = `q${quarter}_self_review_end` as keyof PerformanceCycle;
  const start = cycle[startField];
  const end = cycle[endField];
  
  if (!start || !end) return false;
  
  // Normalize dates to compare date-only (ignore time)
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const startDate = new Date(start as string);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end as string);
  endDate.setHours(23, 59, 59, 999); // Include the entire end date
  
  return now >= startDate && now <= endDate;
}

export function getQuarterTiming(cycle: PerformanceCycle | null, quarter: number): QuarterTiming {
  if (!cycle) return 'future';
  
  const startField = `q${quarter}_self_review_start` as keyof PerformanceCycle;
  const endField = `q${quarter}_self_review_end` as keyof PerformanceCycle;
  const start = cycle[startField];
  const end = cycle[endField];
  
  if (!start || !end) return 'future';
  
  // Normalize dates to compare date-only (ignore time)
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const startDate = new Date(start as string);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end as string);
  endDate.setHours(23, 59, 59, 999); // Include the entire end date
  
  if (now < startDate) return 'future';
  if (now > endDate) return 'past';
  return 'current';
}

export function getQuarterStatus(
  quarterlyEvaluations: Record<number, { status: string } | undefined>,
  quarter: number
): QuarterStatus {
  const evaluation = quarterlyEvaluations[quarter];
  if (!evaluation) return 'not_started';
  if (evaluation.status === 'submitted') return 'submitted';
  if (evaluation.status === 'in_progress') return 'in_progress';
  return 'pending';
}

export function formatQuarterDates(
  cycle: PerformanceCycle,
  quarter: number
): { start: string; end: string } | null {
  const startField = `q${quarter}_self_review_start` as keyof PerformanceCycle;
  const endField = `q${quarter}_self_review_end` as keyof PerformanceCycle;
  const start = cycle[startField];
  const end = cycle[endField];
  
  if (!start || !end) return null;
  
  return {
    start: new Date(start as string).toLocaleDateString(),
    end: new Date(end as string).toLocaleDateString(),
  };
}
