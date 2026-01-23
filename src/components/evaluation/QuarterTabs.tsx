// Quarter Tabs Component
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, Clock, Lock } from 'lucide-react';
import { isQuarterOpen, getQuarterStatus, getQuarterTiming, formatQuarterDates } from '@/utils/quarterUtils';
import type { PerformanceCycle } from '@/types';
import type { QuarterlyCycle } from '@/services/cycle.service';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuarterTabsProps {
  selectedQuarter: string;
  onQuarterChange: (quarter: string) => void;
  cycle: PerformanceCycle | null;
  quarterlyCycles?: QuarterlyCycle[];
  quarterlyEvaluations: Record<number, { status: string } | undefined>;
  children: React.ReactNode;
  /** If true, only allow selecting quarters that have started (self-review period open or past) */
  restrictToOpenQuarters?: boolean;
}

function QuarterStatusIcon({ quarter, cycle, quarterlyCycles, quarterlyEvaluations }: {
  quarter: number;
  cycle: PerformanceCycle | null;
  quarterlyCycles?: QuarterlyCycle[];
  quarterlyEvaluations: Record<number, { status: string } | undefined>;
}) {
  const status = getQuarterStatus(quarterlyEvaluations, quarter);
  const isOpen = isQuarterOpen(cycle, quarter, quarterlyCycles);

  switch (status) {
    case 'submitted':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'in_progress':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'pending':
    case 'not_started':
      return isOpen 
        ? <Clock className="h-4 w-4 text-blue-500" /> 
        : <Lock className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Lock className="h-4 w-4 text-muted-foreground" />;
  }
}

function getQuarterTooltip(cycle: PerformanceCycle | null, quarter: number, quarterlyCycles?: QuarterlyCycle[]): string | null {
  if (!cycle) return null;
  
  const timing = getQuarterTiming(cycle, quarter, quarterlyCycles);
  
  if (timing === 'future') {
    const dates = formatQuarterDates(cycle, quarter, quarterlyCycles);
    if (dates) {
      return `Q${quarter} self-review period is not open yet. It will open from ${dates.start} to ${dates.end}.`;
    }
    return `Q${quarter} self-review period is not open yet.`;
  }
  
  return null;
}

export function QuarterTabs({
  selectedQuarter,
  onQuarterChange,
  cycle,
  quarterlyCycles,
  quarterlyEvaluations,
  children,
  restrictToOpenQuarters = false,
}: QuarterTabsProps) {
  const handleQuarterChange = (quarter: string) => {
    const q = parseInt(quarter);
    
    if (restrictToOpenQuarters) {
      const timing = getQuarterTiming(cycle, q, quarterlyCycles);
      // Only allow if not future (current or past)
      if (timing === 'future') {
        return; // Don't change quarter if it's in the future
      }
    }
    
    onQuarterChange(quarter);
  };

  return (
    <TooltipProvider>
      <Tabs value={selectedQuarter} onValueChange={handleQuarterChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          {[1, 2, 3, 4].map(quarter => {
            const timing = getQuarterTiming(cycle, quarter, quarterlyCycles);
            const isFuture = timing === 'future';
            const isDisabled = restrictToOpenQuarters && isFuture;
            const tooltip = getQuarterTooltip(cycle, quarter, quarterlyCycles);

            const tabButton = (
              <TabsTrigger 
                key={quarter} 
                value={String(quarter)} 
                className={`flex items-center gap-2 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isDisabled}
              >
                Q{quarter}
                <QuarterStatusIcon
                  quarter={quarter}
                  cycle={cycle}
                  quarterlyCycles={quarterlyCycles}
                  quarterlyEvaluations={quarterlyEvaluations}
                />
              </TabsTrigger>
            );

            if (tooltip && isDisabled) {
              return (
                <Tooltip key={quarter}>
                  <TooltipTrigger asChild>
                    <span className="flex-1">
                      {tabButton}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p>{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return tabButton;
          })}
        </TabsList>
        {children}
      </Tabs>
    </TooltipProvider>
  );
}
