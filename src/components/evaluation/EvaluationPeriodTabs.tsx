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

export interface QuarterlySelfEvalStatus {
  quarter: number;
  status: string | null;
}

interface EvaluationPeriodTabsProps {
  cycle: PerformanceCycle | null;
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
}

export function EvaluationPeriodTabs({
  cycle,
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
}: EvaluationPeriodTabsProps) {
  const currentQuarter = getCurrentQuarter(cycle);
  const activeQuarter = controlledQuarter ?? currentQuarter;
  
  // Determine default tab based on current period timing
  const yearEndStatus = getYearEndManagerEvalStatus(cycle);
  const quarterStatus = getQuarterManagerReviewStatus(cycle, currentQuarter);
  
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
                const qStatus = getQuarterManagerReviewStatus(cycle, q);
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
              const qStatus = getQuarterManagerReviewStatus(cycle, q);
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
export function useEvaluationPeriod(cycle: PerformanceCycle | null) {
  const currentQuarter = getCurrentQuarter(cycle);
  const yearEndStatus = getYearEndManagerEvalStatus(cycle);
  const quarterStatus = getQuarterManagerReviewStatus(cycle, currentQuarter);

  return {
    currentQuarter,
    yearEndStatus,
    quarterStatus,
    isQuarterOpen: quarterStatus.timing === 'current',
    isYearEndOpen: yearEndStatus.timing === 'current',
  };
}

export default EvaluationPeriodTabs;
