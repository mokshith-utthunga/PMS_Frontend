// Quarter timing and status utilities
import type { PerformanceCycle } from '@/types';
import type { QuarterlyCycle } from '@/services/cycle.service';

export type QuarterTiming = 'future' | 'current' | 'past';
export type QuarterStatus = 'submitted' | 'in_progress' | 'pending' | 'not_started';

// Helper to get quarterly cycle data
function getQuarterlyCycleData(
  cycle: PerformanceCycle | null,
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): { start: string | null; end: string | null } {
  if (quarterlyCycles && quarterlyCycles.length > 0) {
    const qc = quarterlyCycles.find(qc => {
      const qcQuarter = typeof qc.quarter === 'string' ? parseInt(qc.quarter) : qc.quarter;
      return qcQuarter === quarter;
    });
    if (qc) {
      return {
        start: qc.self_review_start_date || null,
        end: qc.self_review_end_date || null,
      };
    }
  }
  
  // Fallback to deprecated cycle fields for backward compatibility
  if (cycle) {
    const startField = `q${quarter}_self_review_start` as keyof PerformanceCycle;
    const endField = `q${quarter}_self_review_end` as keyof PerformanceCycle;
    return {
      start: (cycle[startField] as string | null | undefined) || null,
      end: (cycle[endField] as string | null | undefined) || null,
    };
  }
  
  return { start: null, end: null };
}

export function isQuarterOpen(
  cycle: PerformanceCycle | null, 
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): boolean {
  if (!cycle) return false;
  
  const { start, end } = getQuarterlyCycleData(cycle, quarter, quarterlyCycles);
  
  if (!start || !end) return false;
  
  // Normalize dates to compare date-only (ignore time)
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999); // Include the entire end date
  
  return now >= startDate && now <= endDate;
}

export function getQuarterTiming(
  cycle: PerformanceCycle | null, 
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): QuarterTiming {
  if (!cycle) return 'future';
  
  const { start, end } = getQuarterlyCycleData(cycle, quarter, quarterlyCycles);
  
  if (!start || !end) return 'future';
  
  // Normalize dates to compare date-only (ignore time)
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end);
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
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): { start: string; end: string } | null {
  const { start, end } = getQuarterlyCycleData(cycle, quarter, quarterlyCycles);
  
  if (!start || !end) return null;
  
  return {
    start: new Date(start).toLocaleDateString(),
    end: new Date(end).toLocaleDateString(),
  };
}
