// Goals Status Alert Components
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { KRA, PerformanceCycle } from '@/types';
import type { DeadlineStatus } from '@/utils/deadlineUtils';

interface BaseAlertProps {
  cycle: PerformanceCycle | null;
  employeeId: string | null;
  isHR: boolean;
}

interface GoalStatusAlertsProps extends BaseAlertProps {
  kras: KRA[];
  deadlineStatus: DeadlineStatus | null;
  hasLatePermission: boolean;
}

// No active cycle alert
export function NoCycleAlert() {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        No active performance cycle. Please contact HR to set up a cycle.
      </AlertDescription>
    </Alert>
  );
}

// Employee profile not set up (non-HR users)
export function NoProfileAlert() {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        Your employee profile is not set up. Please contact HR to link your account.
      </AlertDescription>
    </Alert>
  );
}

// HR user without employee profile
export function HRNoProfileAlert() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription>
        As an HR user, you can manage employee goals from the{' '}
        <Link to="/admin" className="underline font-medium hover:text-primary">
          Admin Panel
        </Link>.
      </AlertDescription>
    </Alert>
  );
}

// All goals approved
export function GoalsApprovedAlert() {
  return (
    <Alert className="border-green-500 bg-green-500/10">
      <CheckCircle2 className="h-4 w-4 text-green-500" />
      <AlertDescription className="text-green-700 dark:text-green-400">
        <strong>Goals Approved:</strong> All your KRAs have been approved by your manager.
      </AlertDescription>
    </Alert>
  );
}

// Late submission granted
export function LateSubmissionGrantedAlert({ formattedDeadline, daysOverdue }: { formattedDeadline: string; daysOverdue: number }) {
  return (
    <Alert className="border-green-500 bg-green-500/10">
      <AlertTriangle className="h-4 w-4 text-green-500" />
      <AlertDescription className="text-green-700 dark:text-green-400">
        <strong>Late Submission Access Granted:</strong> HR has granted you permission to submit goals late.
        Deadline was {formattedDeadline} ({daysOverdue} day{daysOverdue !== 1 ? 's' : ''} ago).
      </AlertDescription>
    </Alert>
  );
}

// Late submission enabled by cycle
export function LateSubmissionEnabledAlert({ formattedDeadline, daysOverdue }: { formattedDeadline: string; daysOverdue: number }) {
  return (
    <Alert className="border-amber-500 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertDescription className="text-amber-700 dark:text-amber-400">
        <strong>Late Submission Enabled:</strong> Goal submission deadline was {formattedDeadline} ({daysOverdue} day{daysOverdue !== 1 ? 's' : ''} ago).
        HR has enabled late submissions while the cycle is active.
      </AlertDescription>
    </Alert>
  );
}

// Deadline passed
export function DeadlinePassedAlert({ formattedDeadline }: { formattedDeadline: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <strong>Deadline Passed:</strong> Goal submission closed on {formattedDeadline}.
        Contact HR if you need to make changes.
      </AlertDescription>
    </Alert>
  );
}

// Main component that renders the appropriate alert
export function GoalStatusAlerts({
  cycle,
  employeeId,
  isHR,
  kras,
  deadlineStatus,
  hasLatePermission,
}: GoalStatusAlertsProps) {
  // No cycle
  if (!cycle) {
    return <NoCycleAlert />;
  }

  // No employee profile
  if (!employeeId && cycle) {
    return isHR ? <HRNoProfileAlert /> : <NoProfileAlert />;
  }

  // No deadline status or no KRAs yet
  if (!deadlineStatus || kras.length === 0) {
    return null;
  }

  const { isPastDeadline, daysOverdue, formattedDeadline } = deadlineStatus;
  const allApproved = kras.every(k => k.status === 'approved');
  const allSubmittedOrApproved = kras.every(k => k.status === 'submitted' || k.status === 'approved');

  // All approved
  if (allApproved) {
    return <GoalsApprovedAlert />;
  }

  // Past deadline scenarios
  if (isPastDeadline) {
    if (hasLatePermission) {
      return <LateSubmissionGrantedAlert formattedDeadline={formattedDeadline} daysOverdue={daysOverdue} />;
    }

    if (cycle.allow_late_goal_submission && cycle.status === 'active') {
      return <LateSubmissionEnabledAlert formattedDeadline={formattedDeadline} daysOverdue={daysOverdue} />;
    }

    if (!allSubmittedOrApproved) {
      return <DeadlinePassedAlert formattedDeadline={formattedDeadline} />;
    }
  }

  return null;
}
