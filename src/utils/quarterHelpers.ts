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

export type FormData = {
    name: string;
    description: string;
    year: number;
    goal_submission_start: string;
    goal_submission_end: string;
    goal_approval_end: string;
    manager_evaluation_start: string;
    manager_evaluation_end: string;
    calibration_start: string;
    calibration_end: string;
    release_date: string;
    allow_late_goal_submission: boolean;
    // Q1 Quarterly Review
    q1_quarter_start_date: string;
    q1_quarter_end_date: string;
    q1_self_review_start: string;
    q1_self_review_end: string;
    q1_manager_review_start: string;
    q1_manager_review_end: string;
    // Q2 Quarterly Review
    q2_quarter_start_date: string;
    q2_quarter_end_date: string;
    q2_self_review_start: string;
    q2_self_review_end: string;
    q2_manager_review_start: string;
    q2_manager_review_end: string;
    // Q3 Quarterly Review
    q3_quarter_start_date: string;
    q3_quarter_end_date: string;
    q3_self_review_start: string;
    q3_self_review_end: string;
    q3_manager_review_start: string;
    q3_manager_review_end: string;
    // Q4 Quarterly Review
    q4_quarter_start_date: string;
    q4_quarter_end_date: string;
    q4_self_review_start: string;
    q4_self_review_end: string;
    q4_manager_review_start: string;
    q4_manager_review_end: string;
  };
// export type quarterIds = {
//   q1_quarter_start_date: string;
//   q1_quarter_end_date: string;
//   q2_quarter_start_date: string;
//   q2_quarter_end_date: string;
//   q3_quarter_start_date: string;
//   q3_quarter_end_date: string;
//   q4_quarter_start_date: string;
//   q4_quarter_end_date: string;
// };

export function getQuarterForDate(date: Date): 1 | 2 | 3 | 4 {
  const month = date.getMonth(); // 0-11
  if (month < 3) return 1; // Jan-Mar
  if (month < 6) return 2; // Apr-Jun
  if (month < 9) return 3; // Jul-Sep
  return 4; // Oct-Dec
}


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


export function getAvailableQuartersForEmployee(
  employee: Employee | null,
  cycle: PerformanceCycle | null,
  goalsQuarterlyCycles?: GoalsQuarterlyCycle[]
): (1 | 2 | 3 | 4)[] {
  if (!employee || !cycle) return [];

  const joinDate = new Date(employee.date_of_joining);
  joinDate.setHours(0, 0, 0, 0);
  
  // If we have goals quarterly cycles, use actual dates from API
  if (goalsQuarterlyCycles && goalsQuarterlyCycles.length > 0) {
    // Find Q1 start date from actual data
    const q1Cycle = goalsQuarterlyCycles.find(gqc => {
      const q = typeof gqc.quarter === 'string' ? parseInt(gqc.quarter) : gqc.quarter;
      return q === 1;
    });
    
    if (q1Cycle?.quarterly_start_date) {
      const q1Start = new Date(q1Cycle.quarterly_start_date);
      q1Start.setHours(0, 0, 0, 0);
      
      // If employee joined before Q1 starts, they have access to all quarters
      if (joinDate < q1Start) {
        return [1, 2, 3, 4];
      }
      
      // Find which quarter the employee joined in based on actual quarter dates
      for (let q = 1; q <= 4; q++) {
        const qCycle = goalsQuarterlyCycles.find(gqc => {
          const gqcQuarter = typeof gqc.quarter === 'string' ? parseInt(gqc.quarter) : gqc.quarter;
          return gqcQuarter === q;
        });
        
        if (qCycle?.quarterly_start_date) {
          const qStart = new Date(qCycle.quarterly_start_date);
          qStart.setHours(0, 0, 0, 0);
          
          // If employee joined before this quarter starts, they get all quarters from previous quarter onwards
          if (joinDate < qStart) {
            const availableQuarters: (1 | 2 | 3 | 4)[] = [];
            for (let availableQ = Math.max(1, q - 1); availableQ <= 4; availableQ++) {
              availableQuarters.push(availableQ as 1 | 2 | 3 | 4);
            }
            return availableQuarters.length > 0 ? availableQuarters : [1, 2, 3, 4];
          }
          
          // If employee joined on or before this quarter starts, they get this quarter and onwards
          if (joinDate <= qStart) {
            const availableQuarters: (1 | 2 | 3 | 4)[] = [];
            for (let availableQ = q; availableQ <= 4; availableQ++) {
              availableQuarters.push(availableQ as 1 | 2 | 3 | 4);
            }
            return availableQuarters;
          }
        }
      }
      
      // If employee joined after all quarters started, they get all quarters
      return [1, 2, 3, 4];
    }
  }
  
  // Fallback: If no goals quarterly cycles data, return all quarters
  // This should not happen in normal operation, but provides a safe default
  return [1, 2, 3, 4];
}


export function getPreviousQuarters(
  currentQuarter: number | null,
  availableQuarters: (1 | 2 | 3 | 4)[]
): (1 | 2 | 3 | 4)[] {
  if (!currentQuarter) return [];
  
  return availableQuarters.filter(q => q < currentQuarter);
}


export function formatQuarterLabel(quarter: number): string {
  return `Q${quarter}`;
}


function getQuarterlyCycleDates(
  cycle: CycleWithQuarterDates | null,
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


export function hasQuarterStarted(
  cycle: CycleWithQuarterDates | null,
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): boolean {
  if (!cycle) return false;

  const { start } = getQuarterlyCycleDates(cycle, quarter, quarterlyCycles);

  if (!start) {
    // No start date from API - quarter has not started
    return false;
  }

  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return now >= startDate;
}


export function getQuarterStartDateFromCycle(
  cycle: CycleWithQuarterDates | null,
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): Date | null {
  if (!cycle) return null;

  const { start } = getQuarterlyCycleDates(cycle, quarter, quarterlyCycles);

  if (!start) {
    return null;
  }

  return new Date(start);
}


export function getQuarterEndDateFromCycle(
  cycle: CycleWithQuarterDates | null,
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): Date | null {
  if (!cycle) return null;

  const { end } = getQuarterlyCycleDates(cycle, quarter, quarterlyCycles);

  if (!end) {
    return null;
  }

  return new Date(end);
}


export function formatDateShort(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('en-US', { 
    month: 'numeric', 
    day: 'numeric', 
    year: 'numeric' 
  });
}


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


export function hasQuarterEnded(
  cycle: CycleWithQuarterDates | null,
  quarter: number,
  quarterlyCycles?: QuarterlyCycle[]
): boolean {
  if (!cycle) return false;

  const endDate = getQuarterEndDateFromCycle(cycle, quarter, quarterlyCycles);
  
  if (!endDate) {
    // No end date from API - quarter has not ended
    return false;
  }

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const now = new Date();

  return now > end;
}


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


export function hasGoalSubmissionStarted(
  cycle: PerformanceCycle | null,
  quarter: number,
  goalsQuarterlyCycles?: GoalsQuarterlyCycle[]
): boolean {
  if (!cycle) return false;

  const { submissionStart } = getGoalsQuarterlyCycleDates(cycle, quarter, goalsQuarterlyCycles);

  if (!submissionStart) {
    // No start date from API - goal submission has not started
    return false;
  }

  const startDate = new Date(submissionStart);
  startDate.setHours(0, 0, 0, 0);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return now >= startDate;
}


export function hasGoalSubmissionEnded(
  cycle: PerformanceCycle | null,
  quarter: number,
  goalsQuarterlyCycles?: GoalsQuarterlyCycle[]
): boolean {
  if (!cycle) return false;

  const { submissionEnd } = getGoalsQuarterlyCycleDates(cycle, quarter, goalsQuarterlyCycles);

  if (!submissionEnd) {
    // No end date from API - goal submission has not ended
    return false;
  }

  const endDate = new Date(submissionEnd);
  endDate.setHours(23, 59, 59, 999);

  const now = new Date();

  return now > endDate;
}


export function getGoalSubmissionEndDate(
  cycle: PerformanceCycle | null,
  quarter: number,
  goalsQuarterlyCycles?: GoalsQuarterlyCycle[]
): Date | null {
  if (!cycle) return null;

  const { submissionEnd } = getGoalsQuarterlyCycleDates(cycle, quarter, goalsQuarterlyCycles);

  if (!submissionEnd) {
    return null;
  }

  return new Date(submissionEnd);
}


export function getGoalSubmissionStartDate(
  cycle: PerformanceCycle | null,
  quarter: number,
  goalsQuarterlyCycles?: GoalsQuarterlyCycle[]
): Date | null {
  if (!cycle) return null;

  const { submissionStart } = getGoalsQuarterlyCycleDates(cycle, quarter, goalsQuarterlyCycles);

  if (!submissionStart) {
    return null;
  }

  return new Date(submissionStart);
}

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
