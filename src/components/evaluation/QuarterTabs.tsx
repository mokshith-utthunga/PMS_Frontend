// Quarter Tabs Component
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, Clock, Lock } from 'lucide-react';
import { isQuarterOpen, getQuarterStatus, type QuarterStatus } from '@/utils/quarterUtils';
import type { PerformanceCycle } from '@/types';

interface QuarterTabsProps {
  selectedQuarter: string;
  onQuarterChange: (quarter: string) => void;
  cycle: PerformanceCycle | null;
  quarterlyEvaluations: Record<number, { status: string } | undefined>;
  children: React.ReactNode;
}

function QuarterStatusIcon({ quarter, cycle, quarterlyEvaluations }: {
  quarter: number;
  cycle: PerformanceCycle | null;
  quarterlyEvaluations: Record<number, { status: string } | undefined>;
}) {
  const status = getQuarterStatus(quarterlyEvaluations, quarter);
  const isOpen = isQuarterOpen(cycle, quarter);

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

export function QuarterTabs({
  selectedQuarter,
  onQuarterChange,
  cycle,
  quarterlyEvaluations,
  children,
}: QuarterTabsProps) {
  return (
    <Tabs value={selectedQuarter} onValueChange={onQuarterChange} className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        {[1, 2, 3, 4].map(quarter => (
          <TabsTrigger key={quarter} value={String(quarter)} className="flex items-center gap-2">
            Q{quarter}
            <QuarterStatusIcon
              quarter={quarter}
              cycle={cycle}
              quarterlyEvaluations={quarterlyEvaluations}
            />
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
