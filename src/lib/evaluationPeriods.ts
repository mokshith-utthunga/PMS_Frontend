/**
 * Centralized evaluation period utilities
 * Used to determine current quarters, check time periods, and manage evaluation states
 */

import type { QuarterlyCycle } from '@/services/cycle.service';

export type Quarter = 1 | 2 | 3 | 4;
export type PeriodTiming = 'future' | 'current' | 'past';

export interface PerformanceCycle {
  id: string;
  name: string;
  status: string;
  year: number;
  // Year-end evaluation dates
  self_evaluation_start?: string | null;
  self_evaluation_end?: string | null;
  manager_evaluation_start?: string | null;
  manager_evaluation_end?: string | null;
  // Quarterly dates (deprecated - now stored in quarterly_cycles table)
  q1_self_review_start?: string | null;
  q1_self_review_end?: string | null;
  q1_manager_review_start?: string | null;
  q1_manager_review_end?: string | null;
  q2_self_review_start?: string | null;
  q2_self_review_end?: string | null;
  q2_manager_review_start?: string | null;
  q2_manager_review_end?: string | null;
  q3_self_review_start?: string | null;
  q3_self_review_end?: string | null;
  q3_manager_review_start?: string | null;
  q3_manager_review_end?: string | null;
  q4_self_review_start?: string | null;
  q4_self_review_end?: string | null;
  q4_manager_review_start?: string | null;
  q4_manager_review_end?: string | null;
}

/**
 * Helper to get quarterly cycle dates from quarterlyCycles array or deprecated cycle fields
 */
function getQuarterlyDates(
  cycle: PerformanceCycle | null,
  quarter: Quarter,
  dateType: 'self_review' | 'manager_review',
  quarterlyCycles?: QuarterlyCycle[]
): { startDate: string | null; endDate: string | null } {
  // First, try to get dates from quarterlyCycles array (preferred - from quarterly_cycles table)
  if (quarterlyCycles && quarterlyCycles.length > 0) {
    const qc = quarterlyCycles.find(qc => {
      const qcQuarter = typeof qc.quarter === 'string' ? parseInt(qc.quarter) : qc.quarter;
      return qcQuarter === quarter;
    });
    if (qc) {
      if (dateType === 'self_review') {
        return {
          startDate: qc.self_review_start_date || null,
          endDate: qc.self_review_end_date || null,
        };
      } else {
        return {
          startDate: qc.quarterly_manager_review_start_date || null,
          endDate: qc.quarterly_manager_review_end_date || null,
        };
      }
    }
  }
  
  // Fallback to deprecated cycle fields for backward compatibility
  if (cycle) {
    const startField = `q${quarter}_${dateType}_start` as keyof PerformanceCycle;
    const endField = `q${quarter}_${dateType}_end` as keyof PerformanceCycle;
    return {
      startDate: (cycle[startField] as string | null | undefined) || null,
      endDate: (cycle[endField] as string | null | undefined) || null,
    };
  }
  
  return { startDate: null, endDate: null };
}

export interface PeriodStatus {
  timing: PeriodTiming;
  startDate: Date | null;
  endDate: Date | null;
  message: string;
}

/**
 * Get the timing status of a date range
 */
export function getDateRangeTiming(
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined
): PeriodTiming {
  if (!startDateStr || !endDateStr) return 'future';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  if (today < startDate) return 'future';
  if (today > endDate) return 'past';
  return 'current';
}

/**
 * Get the current quarter based on cycle dates
 * Returns the quarter that is currently open or the most recent one
 */
export function getCurrentQuarter(
  cycle: PerformanceCycle | null,
  quarterlyCycles?: QuarterlyCycle[]
): Quarter {
  if (!cycle) return 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check each quarter's manager review period
  const quarters: Quarter[] = [1, 2, 3, 4];
  
  // First, find if any quarter is currently open
  for (const q of quarters) {
    const timing = getQuarterManagerReviewTiming(cycle, q, quarterlyCycles);
    if (timing === 'current') {
      return q;
    }
  }

  // If no quarter is currently open, find the next upcoming quarter
  for (const q of quarters) {
    const timing = getQuarterManagerReviewTiming(cycle, q, quarterlyCycles);
    if (timing === 'future') {
      return q;
    }
  }

  // If all quarters are past, return Q4
  return 4;
}

/**
 * Get the timing of a quarter's self review period
 */
export function getQuarterSelfReviewTiming(
  cycle: PerformanceCycle | null,
  quarter: Quarter,
  quarterlyCycles?: QuarterlyCycle[]
): PeriodTiming {
  if (!cycle) return 'future';

  const { startDate, endDate } = getQuarterlyDates(cycle, quarter, 'self_review', quarterlyCycles);
  return getDateRangeTiming(startDate, endDate);
}

/**
 * Get the timing of a quarter's manager review period
 */
export function getQuarterManagerReviewTiming(
  cycle: PerformanceCycle | null,
  quarter: Quarter,
  quarterlyCycles?: QuarterlyCycle[]
): PeriodTiming {
  if (!cycle) return 'future';

  const { startDate, endDate } = getQuarterlyDates(cycle, quarter, 'manager_review', quarterlyCycles);
  return getDateRangeTiming(startDate, endDate);
}

/**
 * Get the timing of year-end self evaluation period
 */
export function getYearEndSelfEvalTiming(cycle: PerformanceCycle | null): PeriodTiming {
  if (!cycle) return 'future';
  return getDateRangeTiming(cycle.self_evaluation_start, cycle.self_evaluation_end);
}

/**
 * Get the timing of year-end manager evaluation period
 */
export function getYearEndManagerEvalTiming(cycle: PerformanceCycle | null): PeriodTiming {
  if (!cycle) return 'future';
  return getDateRangeTiming(cycle.manager_evaluation_start, cycle.manager_evaluation_end);
}

/**
 * Get detailed period status with message
 */
export function getQuarterManagerReviewStatus(
  cycle: PerformanceCycle | null,
  quarter: Quarter,
  quarterlyCycles?: QuarterlyCycle[]
): PeriodStatus {
  if (!cycle) {
    return {
      timing: 'future',
      startDate: null,
      endDate: null,
      message: 'No active performance cycle.',
    };
  }

  const { startDate: startDateStr, endDate: endDateStr } = getQuarterlyDates(
    cycle, quarter, 'manager_review', quarterlyCycles
  );

  const timing = getDateRangeTiming(startDateStr, endDateStr);
  const startDate = startDateStr ? new Date(startDateStr) : null;
  const endDate = endDateStr ? new Date(endDateStr) : null;

  let message = '';
  switch (timing) {
    case 'future':
      message = startDate
        ? `Q${quarter} review period has not started yet. Opens on ${formatDate(startDate)}.`
        : `Q${quarter} review period dates are not configured.`;
      break;
    case 'current':
      message = endDate
        ? `Q${quarter} review period is open. Ends on ${formatDate(endDate)}.`
        : `Q${quarter} review period is currently open.`;
      break;
    case 'past':
      message = `Q${quarter} review period has closed.`;
      break;
  }

  return { timing, startDate, endDate, message };
}

/**
 * Get detailed year-end manager evaluation status with message
 */
export function getYearEndManagerEvalStatus(cycle: PerformanceCycle | null): PeriodStatus {
  if (!cycle) {
    return {
      timing: 'future',
      startDate: null,
      endDate: null,
      message: 'No active performance cycle.',
    };
  }

  const timing = getDateRangeTiming(cycle.manager_evaluation_start, cycle.manager_evaluation_end);
  const startDate = cycle.manager_evaluation_start ? new Date(cycle.manager_evaluation_start) : null;
  const endDate = cycle.manager_evaluation_end ? new Date(cycle.manager_evaluation_end) : null;

  let message = '';
  switch (timing) {
    case 'future':
      message = startDate
        ? `Year-end evaluation period has not started yet. Opens on ${formatDate(startDate)}.`
        : 'Year-end evaluation period dates are not configured.';
      break;
    case 'current':
      message = endDate
        ? `Year-end evaluation period is open. Ends on ${formatDate(endDate)}.`
        : 'Year-end evaluation period is currently open.';
      break;
    case 'past':
      message = 'Year-end evaluation period has closed.';
      break;
  }

  return { timing, startDate, endDate, message };
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get quarter label
 */
export function getQuarterLabel(quarter: Quarter): string {
  return `Q${quarter}`;
}

/**
 * Check if a quarter's self-review is submitted
 */
export function isQuarterlySelfReviewSubmitted(
  quarterlySelfEvals: Record<number, { status: string }>,
  quarter: Quarter
): boolean {
  return quarterlySelfEvals[quarter]?.status === 'submitted';
}
