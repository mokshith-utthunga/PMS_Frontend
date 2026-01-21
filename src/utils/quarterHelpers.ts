// Quarter helper utilities
import type { Employee, PerformanceCycle } from '@/types';

// Extended cycle type with quarterly dates
export interface CycleWithQuarterDates extends PerformanceCycle {
  q1_self_review_start?: string | null;
  q1_self_review_end?: string | null;
  q2_self_review_start?: string | null;
  q2_self_review_end?: string | null;
  q3_self_review_start?: string | null;
  q3_self_review_end?: string | null;
  q4_self_review_start?: string | null;
  q4_self_review_end?: string | null;
}

/**
 * Get the quarter number (1-4) for a given date
 */
export function getQuarterForDate(date: Date): 1 | 2 | 3 | 4 {
  const month = date.getMonth(); // 0-11
  if (month < 3) return 1; // Jan-Mar
  if (month < 6) return 2; // Apr-Jun
  if (month < 9) return 3; // Jul-Sep
  return 4; // Oct-Dec
}

/**
 * Get the start date of a quarter for a given year
 */
export function getQuarterStartDate(year: number, quarter: 1 | 2 | 3 | 4): Date {
  const month = (quarter - 1) * 3; // 0, 3, 6, 9
  return new Date(year, month, 1);
}

/**
 * Get the end date of a quarter for a given year
 */
export function getQuarterEndDate(year: number, quarter: 1 | 2 | 3 | 4): Date {
  const month = quarter * 3; // 3, 6, 9, 12
  return new Date(year, month, 0); // Last day of previous month
}

/**
 * Get available quarters for an employee based on their join date and cycle year
 * Returns array of quarter numbers (1-4) that the employee should have access to
 */
export function getAvailableQuartersForEmployee(
  employee: Employee | null,
  cycle: PerformanceCycle | null
): (1 | 2 | 3 | 4)[] {
  if (!employee || !cycle) return [];

  const joinDate = new Date(employee.date_of_joining);
  const cycleYear = cycle.year;
  
  // Get the quarter when employee joined
  const joinQuarter = getQuarterForDate(joinDate);
  
  // Get the start date of the join quarter in the cycle year
  const joinQuarterStart = getQuarterStartDate(cycleYear, joinQuarter);
  
  // If employee joined before or during the cycle year, they have access to all quarters from their join quarter
  if (joinDate <= joinQuarterStart) {
    // Employee joined before or at the start of their join quarter
    // They have access to all quarters from Q1
    return [1, 2, 3, 4];
  }
  
  // Employee joined during the cycle year
  // They have access to quarters from their join quarter onwards
  const availableQuarters: (1 | 2 | 3 | 4)[] = [];
  for (let q = joinQuarter; q <= 4; q++) {
    availableQuarters.push(q as 1 | 2 | 3 | 4);
  }
  
  return availableQuarters;
}

/**
 * Get previous quarters available for cloning
 * Returns quarters that are before the current quarter
 */
export function getPreviousQuarters(
  currentQuarter: number | null,
  availableQuarters: (1 | 2 | 3 | 4)[]
): (1 | 2 | 3 | 4)[] {
  if (!currentQuarter) return [];
  
  return availableQuarters.filter(q => q < currentQuarter);
}

/**
 * Format quarter label (Q1, Q2, Q3, Q4)
 */
export function formatQuarterLabel(quarter: number): string {
  return `Q${quarter}`;
}

/**
 * Check if a quarter has started based on the cycle's self-review start date
 * For goal setting, we consider a quarter "started" when its self-review period begins
 */
export function hasQuarterStarted(
  cycle: CycleWithQuarterDates | null,
  quarter: number
): boolean {
  if (!cycle) return false;

  const startField = `q${quarter}_self_review_start` as keyof CycleWithQuarterDates;
  const startDateStr = cycle[startField];

  if (!startDateStr) {
    // If no start date is set, fall back to calendar quarter start
    const cycleYear = cycle.year;
    const quarterStartDate = getQuarterStartDate(cycleYear, quarter as 1 | 2 | 3 | 4);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now >= quarterStartDate;
  }

  const startDate = new Date(startDateStr as string);
  startDate.setHours(0, 0, 0, 0);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return now >= startDate;
}

/**
 * Get the start date for a quarter from the cycle
 */
export function getQuarterStartDateFromCycle(
  cycle: CycleWithQuarterDates | null,
  quarter: number
): Date | null {
  if (!cycle) return null;

  const startField = `q${quarter}_self_review_start` as keyof CycleWithQuarterDates;
  const startDateStr = cycle[startField];

  if (!startDateStr) {
    // Fall back to calendar quarter start
    return getQuarterStartDate(cycle.year, quarter as 1 | 2 | 3 | 4);
  }

  return new Date(startDateStr as string);
}

/**
 * Get the end date for a quarter from the cycle
 */
export function getQuarterEndDateFromCycle(
  cycle: CycleWithQuarterDates | null,
  quarter: number
): Date | null {
  if (!cycle) return null;

  const endField = `q${quarter}_self_review_end` as keyof CycleWithQuarterDates;
  const endDateStr = cycle[endField];

  if (!endDateStr) {
    // Fall back to calendar quarter end
    return getQuarterEndDate(cycle.year, quarter as 1 | 2 | 3 | 4);
  }

  return new Date(endDateStr as string);
}

/**
 * Format a date to a readable string
 */
export function formatDateShort(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('en-US', { 
    month: 'numeric', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

/**
 * Get quarter timing status
 */
export type QuarterTimingStatus = 'not_started' | 'in_progress' | 'ended';

export function getQuarterTimingStatus(
  cycle: CycleWithQuarterDates | null,
  quarter: number
): QuarterTimingStatus {
  if (!cycle) return 'not_started';

  const startDate = getQuarterStartDateFromCycle(cycle, quarter);
  const endDate = getQuarterEndDateFromCycle(cycle, quarter);

  if (!startDate) return 'not_started';

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  if (now < start) return 'not_started';

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    if (now > end) return 'ended';
  }

  return 'in_progress';
}

/**
 * Check if a quarter has ended based on the cycle's self-review end date
 */
export function hasQuarterEnded(
  cycle: CycleWithQuarterDates | null,
  quarter: number
): boolean {
  if (!cycle) return false;

  const endDate = getQuarterEndDateFromCycle(cycle, quarter);
  
  if (!endDate) {
    // If no end date, fall back to calendar quarter end
    const cycleYear = cycle.year;
    const quarterEndDate = getQuarterEndDate(cycleYear, quarter as 1 | 2 | 3 | 4);
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return now > quarterEndDate;
  }

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const now = new Date();

  return now > end;
}

/**
 * Check if an employee can work on goals/evaluations for a quarter
 * Returns true if:
 * - Quarter has started AND not ended, OR
 * - Quarter has ended but employee has late permission
 */
export function canWorkOnQuarter(
  cycle: CycleWithQuarterDates | null,
  quarter: number,
  hasLatePermission: boolean
): { canWork: boolean; reason: 'not_started' | 'ended' | 'ok' } {
  if (!cycle) return { canWork: false, reason: 'not_started' };

  const started = hasQuarterStarted(cycle, quarter);
  const ended = hasQuarterEnded(cycle, quarter);

  if (!started) {
    return { canWork: false, reason: 'not_started' };
  }

  if (ended && !hasLatePermission) {
    return { canWork: false, reason: 'ended' };
  }

  return { canWork: true, reason: 'ok' };
}
