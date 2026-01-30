// Deadline and cycle phase utilities
import { differenceInDays, format } from 'date-fns';
import type { PerformanceCycle } from '@/types';

export interface DeadlineStatus {
  isPastDeadline: boolean;
  daysOverdue: number;
  canSubmit: boolean;
  formattedDeadline: string;
}

export function getGoalDeadlineStatus(
  cycle: PerformanceCycle | null,
  hasLatePermission: boolean
): DeadlineStatus | null {
  if (!cycle) return null;
  if (!cycle.goal_submission_end) return null;

  const now = new Date();
  const deadline = new Date(cycle.goal_submission_end);
  // Set deadline to end of day (23:59:59.999) so the entire deadline day is included
  deadline.setHours(23, 59, 59, 999);
  const isPastDeadline = now > deadline;
  const daysOverdue = differenceInDays(now, deadline);
  const canSubmit = !isPastDeadline || cycle.allow_late_goal_submission || hasLatePermission;

  return {
    isPastDeadline,
    daysOverdue,
    canSubmit,
    formattedDeadline: format(deadline, 'MMMM d, yyyy'),
  };
}

export function getCyclePhase(cycle: PerformanceCycle | null): string {
  if (!cycle) return 'No active cycle';
  
  const now = new Date();
  
  if (cycle.goal_submission_end && now < new Date(cycle.goal_submission_end)) return 'Goal Setting Phase';
  if (cycle.goal_approval_end && now < new Date(cycle.goal_approval_end)) return 'Goal Approval Phase';
  if (cycle.self_evaluation_end && now < new Date(cycle.self_evaluation_end)) return 'Self Evaluation Phase';
  if (cycle.manager_evaluation_end && now < new Date(cycle.manager_evaluation_end)) return 'Manager Evaluation Phase';
  if (cycle.calibration_end && now < new Date(cycle.calibration_end)) return 'Calibration Phase';
  
  return 'Release Phase';
}

export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return 'Not configured';
  return `${format(new Date(start), 'MMM d')} - ${format(new Date(end), 'MMM d, yyyy')}`;
}
