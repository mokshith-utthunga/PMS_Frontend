// KRA Weight Progress Card Component
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MIN_KRAS, TOTAL_WEIGHT } from '@/utils/constants';

interface GoalsProgressCardProps {
  totalWeight: number;
  krasCount: number;
}

export function GoalsProgressCard({ totalWeight, krasCount }: GoalsProgressCardProps) {
  const isWeightValid = totalWeight === TOTAL_WEIGHT;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm font-medium">Total KRA Weight</span>
            <span className="text-xs text-muted-foreground ml-2">
              ({krasCount}/{MIN_KRAS}-5 KRAs)
            </span>
          </div>
          <span className={`text-sm font-medium ${isWeightValid ? 'text-primary' : 'text-muted-foreground'}`}>
            {totalWeight}% / {TOTAL_WEIGHT}%
          </span>
        </div>
        <Progress value={totalWeight} className="h-2" />
        {krasCount > 0 && !isWeightValid && (
          <p className="text-xs text-muted-foreground mt-2">
            {totalWeight < TOTAL_WEIGHT
              ? `Add ${TOTAL_WEIGHT - totalWeight}% more KRA weight`
              : `Reduce ${totalWeight - TOTAL_WEIGHT}% KRA weight`}
          </p>
        )}
        {krasCount < MIN_KRAS && (
          <p className="text-xs text-destructive mt-1">
            Minimum {MIN_KRAS} KRAs required. Add {MIN_KRAS - krasCount} more.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
