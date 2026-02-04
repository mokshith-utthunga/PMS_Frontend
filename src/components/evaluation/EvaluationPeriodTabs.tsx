/**
 * Centralized Evaluation Period Tabs Component
 * Used across all evaluation-related pages for consistent tab navigation
 */

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Calendar, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  PerformanceCycle,
  Quarter,
  getCurrentQuarter,
  getQuarterManagerReviewStatus,
  getYearEndManagerEvalStatus,
  getQuarterLabel,
} from '@/lib/evaluationPeriods';
import type { QuarterlyCycle } from '@/services/cycle.service';

export interface QuarterlySelfEvalStatus {
  quarter: number;
  status: string | null;
}

interface EvaluationPeriodTabsProps {
  cycle: PerformanceCycle | null;
  quarterlyCycles?: QuarterlyCycle[];
  quarterlySelfEvals?: Record<number, { status: string }>;
  yearEndSelfEvalStatus?: string | null;
  defaultTab?: 'quarterly' | 'year-end';
  onTabChange?: (tab: 'quarterly' | 'year-end', quarter?: Quarter) => void;
  selectedQuarter?: Quarter;
  onQuarterChange?: (quarter: Quarter) => void;
  quarterlyContent?: React.ReactNode;
  yearEndContent?: React.ReactNode;
  showQuarterSubTabs?: boolean;
  className?: string;
  // Backend response for tab enabling (optional - falls back to date calculation if not provided)
  managerReview?: {
    review_for_quarter: number | null;
    present_quarter: number | null;
    enabled: boolean;
  };
}

export function EvaluationPeriodTabs({
  cycle,
  quarterlyCycles,
  quarterlySelfEvals = {},
  yearEndSelfEvalStatus,
  defaultTab,
  onTabChange,
  selectedQuarter: controlledQuarter,
  onQuarterChange,
  quarterlyContent,
  yearEndContent,
  showQuarterSubTabs = true,
  className,
  managerReview,
}: EvaluationPeriodTabsProps) {
  // Use backend response for current quarter if available, otherwise fall back to date calculation
  const backendCurrentQuarter = managerReview?.present_quarter;
  const currentQuarter = backendCurrentQuarter || getCurrentQuarter(cycle, quarterlyCycles);
  const activeQuarter = controlledQuarter ?? currentQuarter;
  
  // Determine default tab based on backend response or current period timing
  const yearEndStatus = getYearEndManagerEvalStatus(cycle);
  // Use backend response for quarter status if available
  const quarterStatus = managerReview?.enabled && managerReview?.review_for_quarter === currentQuarter
    ? { timing: 'current' as const, message: 'Manager review period is open' }
    : getQuarterManagerReviewStatus(cycle, currentQuarter, quarterlyCycles);
  
  const computedDefaultTab = defaultTab ?? (
    quarterStatus.timing === 'current' ? 'quarterly' :
    yearEndStatus.timing === 'current' ? 'year-end' :
    'quarterly'
  );

  const handleMainTabChange = (value: string) => {
    if (value === 'quarterly' || value === 'year-end') {
      onTabChange?.(value, value === 'quarterly' ? activeQuarter : undefined);
    }
  };

  const handleQuarterChange = (value: string) => {
    const quarter = parseInt(value.replace('q', '')) as Quarter;
    onQuarterChange?.(quarter);
    onTabChange?.('quarterly', quarter);
  };

  return (
    <Tabs 
      defaultValue={computedDefaultTab} 
      onValueChange={handleMainTabChange}
      className={className}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="quarterly" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Current Quarter ({getQuarterLabel(currentQuarter)})
          {quarterStatus.timing === 'current' && (
            <Badge variant="secondary" className="ml-1 text-xs">Open</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="year-end" className="flex items-center gap-2">
          Year-End Evaluation
          {yearEndStatus.timing === 'current' && (
            <Badge variant="secondary" className="ml-1 text-xs">Open</Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="quarterly" className="space-y-4 mt-4">
        {showQuarterSubTabs && (
          <Tabs 
            value={`q${activeQuarter}`} 
            onValueChange={handleQuarterChange}
          >
            <TabsList>
              {([1, 2, 3, 4] as Quarter[]).map((q) => {
                // Use backend response to determine if manager review is enabled for this quarter
                const isReviewQuarter = managerReview?.review_for_quarter === q;
                const isManagerReviewEnabled = isReviewQuarter && managerReview?.enabled === true;
                
                // Fallback to date calculation if backend data not available
                const qStatus = managerReview && isReviewQuarter
                  ? (isManagerReviewEnabled 
                      ? { timing: 'current' as const, message: 'Manager review period is open' }
                      : { timing: 'future' as const, message: 'Manager review period is not open' })
                  : getQuarterManagerReviewStatus(cycle, q, quarterlyCycles);
                
                const selfSubmitted = quarterlySelfEvals[q]?.status === 'submitted';
                
                return (
                  <TabsTrigger key={q} value={`q${q}`} className="relative">
                    Q{q}
                    {qStatus.timing === 'current' && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                    )}
                    {selfSubmitted && qStatus.timing !== 'current' && (
                      <CheckCircle2 className="ml-1 h-3 w-3 text-green-500" />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {([1, 2, 3, 4] as Quarter[]).map((q) => {
              // Use backend response to determine if manager review is enabled for this quarter
              const isReviewQuarter = managerReview?.review_for_quarter === q;
              const isManagerReviewEnabled = isReviewQuarter && managerReview?.enabled === true;
              
              // Fallback to date calculation if backend data not available
              const qStatus = managerReview && isReviewQuarter
                ? (isManagerReviewEnabled 
                    ? { timing: 'current' as const, message: 'Manager review period is open' }
                    : { timing: 'future' as const, message: 'Manager review period is not open' })
                : getQuarterManagerReviewStatus(cycle, q, quarterlyCycles);
              
              const selfSubmitted = quarterlySelfEvals[q]?.status === 'submitted';

              return (
                <TabsContent key={q} value={`q${q}`} className="space-y-4">
                  <PeriodStatusAlert
                    timing={qStatus.timing}
                    message={qStatus.message}
                    selfEvalSubmitted={selfSubmitted}
                    periodType="quarterly"
                    quarter={q}
                  />
                  {quarterlyContent}
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {!showQuarterSubTabs && (
          <>
            <PeriodStatusAlert
              timing={quarterStatus.timing}
              message={quarterStatus.message}
              selfEvalSubmitted={quarterlySelfEvals[activeQuarter]?.status === 'submitted'}
              periodType="quarterly"
              quarter={activeQuarter}
            />
            {quarterlyContent}
          </>
        )}
      </TabsContent>

      <TabsContent value="year-end" className="space-y-4 mt-4">
        <PeriodStatusAlert
          timing={yearEndStatus.timing}
          message={yearEndStatus.message}
          selfEvalSubmitted={yearEndSelfEvalStatus === 'submitted'}
          periodType="year-end"
        />
        {yearEndContent}
      </TabsContent>
    </Tabs>
  );
}

interface PeriodStatusAlertProps {
  timing: 'future' | 'current' | 'past';
  message: string;
  selfEvalSubmitted?: boolean;
  periodType: 'quarterly' | 'year-end';
  quarter?: Quarter;
}

export function PeriodStatusAlert({
  timing,
  message,
  selfEvalSubmitted,
  periodType,
  quarter,
}: PeriodStatusAlertProps) {
  const getIcon = () => {
    switch (timing) {
      case 'future':
        return <Lock className="h-4 w-4" />;
      case 'current':
        return <Calendar className="h-4 w-4" />;
      case 'past':
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    if (timing === 'current') return 'default';
    return 'destructive';
  };

  // For quarterly reviews, also check if self-eval is submitted
  if (timing === 'current' && periodType === 'quarterly' && !selfEvalSubmitted) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {quarter ? `Q${quarter}` : 'Quarterly'} self-evaluation has not been submitted by the employee yet.
        </AlertDescription>
      </Alert>
    );
  }

  if (timing === 'current' && selfEvalSubmitted) {
    return (
      <Alert className="border-green-200 bg-green-50 text-green-800">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription>
          {message} Self-evaluation has been submitted and is ready for your review.
        </AlertDescription>
      </Alert>
    );
  }

  if (timing !== 'current') {
    return (
      <Alert variant={getVariant()}>
        {getIcon()}
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      {getIcon()}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/**
 * Simple hook to get evaluation period info
 */
export function useEvaluationPeriod(cycle: PerformanceCycle | null, quarterlyCycles?: QuarterlyCycle[]) {
  const currentQuarter = getCurrentQuarter(cycle, quarterlyCycles);
  const yearEndStatus = getYearEndManagerEvalStatus(cycle);
  const quarterStatus = getQuarterManagerReviewStatus(cycle, currentQuarter, quarterlyCycles);

  return {
    currentQuarter,
    yearEndStatus,
    quarterStatus,
    isQuarterOpen: quarterStatus.timing === 'current',
    isYearEndOpen: yearEndStatus.timing === 'current',
  };
}

export default EvaluationPeriodTabs;
