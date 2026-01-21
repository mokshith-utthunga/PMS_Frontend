/**
 * Centralized evaluation period utilities
 * Used to determine current quarters, check time periods, and manage evaluation states
 */

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
  // Quarterly dates
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
export function getCurrentQuarter(cycle: PerformanceCycle | null): Quarter {
  if (!cycle) return 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check each quarter's manager review period
  const quarters: Quarter[] = [1, 2, 3, 4];
  
  // First, find if any quarter is currently open
  for (const q of quarters) {
    const timing = getQuarterManagerReviewTiming(cycle, q);
    if (timing === 'current') {
      return q;
    }
  }

  // If no quarter is currently open, find the next upcoming quarter
  for (const q of quarters) {
    const timing = getQuarterManagerReviewTiming(cycle, q);
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
  quarter: Quarter
): PeriodTiming {
  if (!cycle) return 'future';

  const startField = `q${quarter}_self_review_start` as keyof PerformanceCycle;
  const endField = `q${quarter}_self_review_end` as keyof PerformanceCycle;

  return getDateRangeTiming(
    cycle[startField] as string | null,
    cycle[endField] as string | null
  );
}

/**
 * Get the timing of a quarter's manager review period
 */
export function getQuarterManagerReviewTiming(
  cycle: PerformanceCycle | null,
  quarter: Quarter
): PeriodTiming {
  if (!cycle) return 'future';

  const startField = `q${quarter}_manager_review_start` as keyof PerformanceCycle;
  const endField = `q${quarter}_manager_review_end` as keyof PerformanceCycle;

  return getDateRangeTiming(
    cycle[startField] as string | null,
    cycle[endField] as string | null
  );
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
  quarter: Quarter
): PeriodStatus {
  if (!cycle) {
    return {
      timing: 'future',
      startDate: null,
      endDate: null,
      message: 'No active performance cycle.',
    };
  }

  const startField = `q${quarter}_manager_review_start` as keyof PerformanceCycle;
  const endField = `q${quarter}_manager_review_end` as keyof PerformanceCycle;

  const startDateStr = cycle[startField] as string | null;
  const endDateStr = cycle[endField] as string | null;

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
