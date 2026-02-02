// Period Helpers - Utilities for handling mid-quarter transitions
import type { PeriodType } from '@/services/transition.service';

/**
 * Get period label for display
 */
export function getPeriodLabel(periodType: PeriodType | null | undefined): string {
  if (!periodType || periodType === 'full_quarter') {
    return 'Full Quarter';
  }
  if (periodType === 'pre_transition') {
    return 'Pre-Transition Period';
  }
  if (periodType === 'post_transition') {
    return 'Post-Transition Period';
  }
  return 'Unknown Period';
}

/**
 * Get period badge variant for UI
 */
export function getPeriodBadgeVariant(periodType: PeriodType | null | undefined): 'default' | 'secondary' | 'outline' {
  if (!periodType || periodType === 'full_quarter') {
    return 'default';
  }
  if (periodType === 'pre_transition') {
    return 'secondary';
  }
  if (periodType === 'post_transition') {
    return 'outline';
  }
  return 'default';
}

/**
 * Check if period is a transition period
 */
export function isTransitionPeriod(periodType: PeriodType | null | undefined): boolean {
  return periodType === 'pre_transition' || periodType === 'post_transition';
}

/**
 * Format period date range for display
 */
export function formatPeriodDateRange(startDate: string | null | undefined, endDate: string | null | undefined): string {
  if (!startDate || !endDate) {
    return 'Date range not available';
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startFormatted = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const endFormatted = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  return `${startFormatted} - ${endFormatted}`;
}

/**
 * Calculate number of days in a period
 */
export function calculatePeriodDays(startDate: string | null | undefined, endDate: string | null | undefined): number {
  if (!startDate || !endDate) {
    return 0;
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both dates
}

/**
 * Get period type from transition and date
 */
export function getPeriodType(
  hasTransition: boolean,
  transitionDate: string | null | undefined,
  currentDate: Date = new Date()
): PeriodType {
  if (!hasTransition || !transitionDate) {
    return 'full_quarter';
  }
  
  const transition = new Date(transitionDate);
  return currentDate < transition ? 'pre_transition' : 'post_transition';
}
