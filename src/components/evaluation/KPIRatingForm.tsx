// KPI Rating Form for Self Evaluation
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Star } from 'lucide-react';
import { AchievementSlider, parseNumericTarget } from '@/components/evaluation/AchievementSlider';
import type { Goal, RatingScale } from '@/types';
import type { GoalRating } from '@/hooks/useEvaluationsData';

interface KPIRatingFormProps {
  kpi: Goal;
  rating: GoalRating | undefined;
  ratingScales: RatingScale[];
  canEdit: boolean;
  onRatingChange: (goalId: string, field: keyof GoalRating, value: unknown) => void;
}

export function KPIRatingForm({
  kpi,
  rating,
  ratingScales,
  canEdit,
  onRatingChange,
}: KPIRatingFormProps) {
  const numericTarget = parseNumericTarget(kpi.target_value);
  const currentAchieved = rating?.achieved_value ?? 0;

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary">KPI</Badge>
          <span className="text-sm text-muted-foreground">Weight: {kpi.weight}%</span>
        </div>
        <h4 className="font-medium">{kpi.title}</h4>
        {kpi.description && (
          <p className="text-sm text-muted-foreground mt-1">{kpi.description}</p>
        )}
        {kpi.target_value && (
          <p className="text-sm mt-1">
            <span className="text-muted-foreground">Target: </span>
            {kpi.target_value}
          </p>
        )}
      </div>

      {/* Achievement Slider for numeric targets */}
      {numericTarget !== null && (
        <div className="space-y-2">
          <Label>Your Achievement</Label>
          <AchievementSlider
            targetValue={numericTarget}
            achievedValue={currentAchieved}
            onChange={value => onRatingChange(kpi.id, 'achieved_value', value)}
            disabled={!canEdit}
            label="Achievement Progress"
            variant="employee"
          />
        </div>
      )}

      {/* Achievement Text */}
      <div className="space-y-2">
        <Label>What did you achieve? *</Label>
        <Textarea
          placeholder="Describe your achievements and outcomes..."
          value={rating?.achievement || ''}
          onChange={e => onRatingChange(kpi.id, 'achievement', e.target.value)}
          disabled={!canEdit}
          rows={2}
        />
      </div>

      {/* Evidence */}
      <div className="space-y-2">
        <Label>Evidence / Supporting Data</Label>
        <Textarea
          placeholder="Links, metrics, or references..."
          value={rating?.evidence || ''}
          onChange={e => onRatingChange(kpi.id, 'evidence', e.target.value)}
          disabled={!canEdit}
          rows={2}
        />
      </div>

      {/* Self Rating */}
      <div className="space-y-2">
        <Label>Self Rating *</Label>
        <RadioGroup
          value={rating?.self_rating?.toString() || ''}
          onValueChange={value => onRatingChange(kpi.id, 'self_rating', parseInt(value))}
          disabled={!canEdit}
          className="flex flex-wrap gap-4"
        >
          {ratingScales.map(scale => (
            <div key={scale.value} className="flex items-center space-x-2">
              <RadioGroupItem value={scale.value.toString()} id={`${kpi.id}-${scale.value}`} />
              <Label htmlFor={`${kpi.id}-${scale.value}`} className="cursor-pointer flex items-center gap-1">
                <Star className="h-4 w-4" style={{ color: scale.color || undefined }} />
                {scale.value} - {scale.name}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
