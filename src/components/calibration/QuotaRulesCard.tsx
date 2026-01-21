// Quota Rules Card Component
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { TOTAL_WEIGHT } from '@/utils/constants';
import type { RatingScale } from '@/types';
import type { QuotaRule } from '@/hooks/useCalibrationForm';

interface QuotaRulesCardProps {
  ratingScales: RatingScale[];
  quotaRules: QuotaRule[];
  totalPercentage: number;
  onQuotaChange: (ratingValue: number, percentage: number) => void;
}

export function QuotaRulesCard({
  ratingScales,
  quotaRules,
  totalPercentage,
  onQuotaChange,
}: QuotaRulesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating Distribution Quotas</CardTitle>
        <CardDescription>
          Set target percentages for each rating level. Total must equal 100%.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ratingScales.map(scale => {
          const quota = quotaRules.find(r => r.rating_value === scale.value);
          return (
            <div key={scale.value} className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: scale.color || '#888' }}
                  />
                  {scale.value} - {scale.name}
                </Label>
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={quota?.percentage || 0}
                  onChange={e => onQuotaChange(scale.value, parseInt(e.target.value) || 0)}
                  className="text-right"
                />
              </div>
              <span className="text-sm text-muted-foreground w-8">%</span>
            </div>
          );
        })}

        <div className="flex items-center justify-end gap-4 pt-2 border-t">
          <span className="font-medium">Total:</span>
          <span className={totalPercentage === TOTAL_WEIGHT ? 'text-primary' : 'text-destructive'}>
            {totalPercentage}%
          </span>
        </div>

        {totalPercentage !== TOTAL_WEIGHT && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Quota percentages must total 100%</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
