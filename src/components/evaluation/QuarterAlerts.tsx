// Quarter Status Alerts
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClipboardCheck, Lock, AlertCircle } from 'lucide-react';
import { isQuarterOpen, getQuarterTiming, formatQuarterDates } from '@/utils/quarterUtils';
import type { PerformanceCycle } from '@/types';
import type { QuarterlyCycle } from '@/services/cycle.service';

interface QuarterAlertsProps {
  quarter: number;
  cycle: PerformanceCycle | null;
  quarterlyCycles?: QuarterlyCycle[];
  isSubmitted: boolean;
}

export function QuarterAlerts({ quarter, cycle, quarterlyCycles, isSubmitted }: QuarterAlertsProps) {
  if (!cycle) return null;

  const timing = getQuarterTiming(cycle, quarter, quarterlyCycles);
  const dates = formatQuarterDates(cycle, quarter, quarterlyCycles);

  if (isSubmitted) {
    return (
      <Alert>
        <ClipboardCheck className="h-4 w-4" />
        <AlertDescription>
          Q{quarter} self evaluation has been submitted and is pending manager review.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isQuarterOpen(cycle, quarter, quarterlyCycles) && timing === 'future') {
    return (
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertDescription>
          Q{quarter} self-review period is not open yet. It will open from{' '}
          {dates?.start || 'TBD'} to {dates?.end || 'TBD'}.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isQuarterOpen(cycle, quarter, quarterlyCycles) && timing === 'past') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Q{quarter} self-review period has closed.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
