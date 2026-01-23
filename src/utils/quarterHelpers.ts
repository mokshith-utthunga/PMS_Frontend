// Quarter helper utilities
import type { Employee, PerformanceCycle } from '@/types';
import type { QuarterlyCycle, GoalsQuarterlyCycle } from '@/services/cycle.service';

// Extended cycle type with quarterly dates (deprecated - use quarterlyCycles array instead)
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
 * Helper to get quarterly cycle data from quarterlyCycles array or fallback to deprecated cycle fields
 */
function getQuarterlyCycleDates(
  cycle: CycleWithQuarterDates | null,
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): { start: string | null; end: string | null } {
  // First, try to get dates from quarterlyCycles array (preferred - from quarterly_cycles table)
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
    const startField = `q${quarter}_self_review_start` as keyof CycleWithQuarterDates;
    const endField = `q${quarter}_self_review_end` as keyof CycleWithQuarterDates;
    return {
      start: (cycle[startField] as string | null | undefined) || null,
      end: (cycle[endField] as string | null | undefined) || null,
    };
  }
  
  return { start: null, end: null };
}

/**
 * Helper to get goals quarterly cycle data
 */
function getGoalsQuarterlyCycleDates(
  cycle: PerformanceCycle | null,
  quarter: number,
  goalsQuarterlyCycles?: GoalsQuarterlyCycle[]
): { 
  submissionStart: string | null; 
  submissionEnd: string | null;
  managerReviewStart: string | null;
  managerReviewEnd: string | null;
  quarterStart: string | null;
  quarterEnd: string | null;
} {
  if (goalsQuarterlyCycles && goalsQuarterlyCycles.length > 0) {
    const gqc = goalsQuarterlyCycles.find(gqc => {
      const gqcQuarter = typeof gqc.quarter === 'string' ? parseInt(gqc.quarter) : gqc.quarter;
      return gqcQuarter === quarter;
    });
    if (gqc) {
      return {
        submissionStart: gqc.goal_submission_start_date || null,
        submissionEnd: gqc.goal_submission_end_date || null,
        managerReviewStart: gqc.goals_manager_review_start_date || null,
        managerReviewEnd: gqc.goals_manager_review_end_date || null,
        quarterStart: gqc.quarterly_start_date || null,
        quarterEnd: gqc.quarterly_end_date || null,
      };
    }
  }
  
  return { 
    submissionStart: null, 
    submissionEnd: null, 
    managerReviewStart: null, 
    managerReviewEnd: null,
    quarterStart: null,
    quarterEnd: null,
  };
}

/**
 * Check if a quarter has started based on the cycle's self-review start date
 * Uses quarterlyCycles array if available, falls back to deprecated cycle fields
 */
export function hasQuarterStarted(
  cycle: CycleWithQuarterDates | null,
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): boolean {
  if (!cycle) return false;

  const { start } = getQuarterlyCycleDates(cycle, quarter, quarterlyCycles);

  if (!start) {
    // If no start date is set, fall back to calendar quarter start
    const cycleYear = cycle.year;
    const quarterStartDate = getQuarterStartDate(cycleYear, quarter as 1 | 2 | 3 | 4);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now >= quarterStartDate;
  }

  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return now >= startDate;
}

/**
 * Get the start date for a quarter from the cycle or quarterlyCycles
 */
export function getQuarterStartDateFromCycle(
  cycle: CycleWithQuarterDates | null,
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): Date | null {
  if (!cycle) return null;

  const { start } = getQuarterlyCycleDates(cycle, quarter, quarterlyCycles);

  if (!start) {
    // Fall back to calendar quarter start
    return getQuarterStartDate(cycle.year, quarter as 1 | 2 | 3 | 4);
  }

  return new Date(start);
}

/**
 * Get the end date for a quarter from the cycle or quarterlyCycles
 */
export function getQuarterEndDateFromCycle(
  cycle: CycleWithQuarterDates | null,
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): Date | null {
  if (!cycle) return null;

  const { end } = getQuarterlyCycleDates(cycle, quarter, quarterlyCycles);

  if (!end) {
    // Fall back to calendar quarter end
    return getQuarterEndDate(cycle.year, quarter as 1 | 2 | 3 | 4);
  }

  return new Date(end);
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
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): QuarterTimingStatus {
  if (!cycle) return 'not_started';

  const startDate = getQuarterStartDateFromCycle(cycle, quarter, quarterlyCycles);
  const endDate = getQuarterEndDateFromCycle(cycle, quarter, quarterlyCycles);

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
 * Uses quarterlyCycles array if available, falls back to deprecated cycle fields
 */
export function hasQuarterEnded(
  cycle: CycleWithQuarterDates | null,
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): boolean {
  if (!cycle) return false;

  const endDate = getQuarterEndDateFromCycle(cycle, quarter, quarterlyCycles);
  
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
  hasLatePermission: boolean,
  quarterlyCycles?: QuarterlyCycle[]
): { canWork: boolean; reason: 'not_started' | 'ended' | 'ok' } {
  if (!cycle) return { canWork: false, reason: 'not_started' };

  const started = hasQuarterStarted(cycle, quarter, quarterlyCycles);
  const ended = hasQuarterEnded(cycle, quarter, quarterlyCycles);

  if (!started) {
    return { canWork: false, reason: 'not_started' };
  }

  if (ended && !hasLatePermission) {
    return { canWork: false, reason: 'ended' };
  }

  return { canWork: true, reason: 'ok' };
}

/**
 * Check if goal submission has started for a quarter
 */
export function hasGoalSubmissionStarted(
  cycle: PerformanceCycle | null,
  quarter: number,
  goalsQuarterlyCycles?: GoalsQuarterlyCycle[]
): boolean {
  if (!cycle) return false;

  const { submissionStart } = getGoalsQuarterlyCycleDates(cycle, quarter, goalsQuarterlyCycles);

  if (!submissionStart) {
    // If no start date, fall back to calendar quarter start
    const quarterStartDate = getQuarterStartDate(cycle.year, quarter as 1 | 2 | 3 | 4);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now >= quarterStartDate;
  }

  const startDate = new Date(submissionStart);
  startDate.setHours(0, 0, 0, 0);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return now >= startDate;
}

/**
 * Check if goal submission has ended for a quarter
 */
export function hasGoalSubmissionEnded(
  cycle: PerformanceCycle | null,
  quarter: number,
  goalsQuarterlyCycles?: GoalsQuarterlyCycle[]
): boolean {
  if (!cycle) return false;

  const { submissionEnd } = getGoalsQuarterlyCycleDates(cycle, quarter, goalsQuarterlyCycles);

  if (!submissionEnd) {
    // If no end date, fall back to calendar quarter end
    const quarterEndDate = getQuarterEndDate(cycle.year, quarter as 1 | 2 | 3 | 4);
    const now = new Date();
    return now > quarterEndDate;
  }

  const endDate = new Date(submissionEnd);
  endDate.setHours(23, 59, 59, 999);

  const now = new Date();

  return now > endDate;
}

/**
 * Get goal submission end date for a quarter
 */
export function getGoalSubmissionEndDate(
  cycle: PerformanceCycle | null,
  quarter: number,
  goalsQuarterlyCycles?: GoalsQuarterlyCycle[]
): Date | null {
  if (!cycle) return null;

  const { submissionEnd } = getGoalsQuarterlyCycleDates(cycle, quarter, goalsQuarterlyCycles);

  if (!submissionEnd) {
    return getQuarterEndDate(cycle.year, quarter as 1 | 2 | 3 | 4);
  }

  return new Date(submissionEnd);
}

/**
 * Get goal submission start date for a quarter
 */
export function getGoalSubmissionStartDate(
  cycle: PerformanceCycle | null,
  quarter: number,
  goalsQuarterlyCycles?: GoalsQuarterlyCycle[]
): Date | null {
  if (!cycle) return null;

  const { submissionStart } = getGoalsQuarterlyCycleDates(cycle, quarter, goalsQuarterlyCycles);

  if (!submissionStart) {
    return getQuarterStartDate(cycle.year, quarter as 1 | 2 | 3 | 4);
  }

  return new Date(submissionStart);
}

/**
 * Get manager goal review dates for a quarter
 */
export function getManagerGoalReviewDates(
  cycle: PerformanceCycle | null,
  quarter: number,
  goalsQuarterlyCycles?: GoalsQuarterlyCycle[]
): { start: Date | null; end: Date | null } {
  if (!cycle) return { start: null, end: null };

  const { managerReviewStart, managerReviewEnd } = getGoalsQuarterlyCycleDates(cycle, quarter, goalsQuarterlyCycles);

  return {
    start: managerReviewStart ? new Date(managerReviewStart) : null,
    end: managerReviewEnd ? new Date(managerReviewEnd) : null,
  };
}
