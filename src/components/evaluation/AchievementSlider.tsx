import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface AchievementSliderProps {
  targetValue: number;
  achievedValue: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  label: string;
  variant?: 'employee' | 'manager';
  showPercentage?: boolean;
}

function parseNumericTarget(targetValue: string | null): number | null {
  if (!targetValue) return null;
  const match = targetValue.match(/^\d+/);
  return match ? parseInt(match[0]) : null;
}

function getStepSize(targetValue: number): number {
  if (targetValue <= 10) return 0.1;
  if (targetValue <= 100) return 1;
  return 1;
}

export function AchievementSlider({
  targetValue,
  achievedValue,
  onChange,
  disabled = false,
  label,
  variant = 'employee',
  showPercentage = true,
}: AchievementSliderProps) {
  // Convert achieved value to percentage for display and slider
  const percentage = targetValue > 0 ? Math.round((achievedValue / targetValue) * 100) : 0;
  const isManager = variant === 'manager';

  // Handle percentage change - convert back to achieved value
  const handlePercentageChange = (newPercentage: number) => {
    const newAchievedValue = (newPercentage / 100) * targetValue;
    onChange?.(newAchievedValue);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(
          "font-medium",
          isManager ? "text-green-600 dark:text-green-400" : "text-primary"
        )}>
          {percentage}%
          {showPercentage && ` (Target: ${targetValue})`}
        </span>
      </div>
      
      {disabled ? (
        <div className="relative">
          <Progress 
            value={percentage} 
            className={cn(
              "h-3",
              isManager && "[&>div]:bg-green-500"
            )}
          />
        </div>
      ) : (
        <Slider
          value={[percentage]}
          onValueChange={(values) => handlePercentageChange(values[0])}
          max={100}
          min={0}
          step={1}
          disabled={disabled}
          className={cn(
            isManager && "[&_[data-radix-slider-range]]:bg-green-500 [&_[data-radix-slider-thumb]]:border-green-500"
          )}
        />
      )}
    </div>
  );
}

/**
 * Calculate rating based on achievement percentage
 * >= 100% → 5 (Exceptional)
 * >= 80% → 4 (Exceeds Expectations)
 * >= 60% → 3 (Meets Expectations)
 * >= 40% → 2 (Needs Improvement)
 * < 40% → 1 (Unsatisfactory)
 */
export function calculateRatingFromAchievement(percentage: number): number {
  if (percentage >= 100) return 5;
  if (percentage >= 80) return 4;  // difference from 100% < 20%
  if (percentage >= 60) return 3;  // difference from 100% < 40%
  if (percentage >= 40) return 2;  // difference from 100% < 60%
  return 1;                        // difference from 100% >= 60%
}

export function DualAchievementSlider({
  targetValue,
  employeeAchieved,
  managerAchieved,
  onManagerChange,
  onRatingChange,
  disabled = false,
  showAutoRating = true,
}: {
  targetValue: number;
  employeeAchieved: number;
  managerAchieved: number;
  onManagerChange?: (value: number) => void;
  onRatingChange?: (rating: number) => void;
  disabled?: boolean;
  showAutoRating?: boolean;
}) {
  const employeePercentage = targetValue > 0 ? Math.round((employeeAchieved / targetValue) * 100) : 0;
  const managerPercentage = targetValue > 0 ? Math.round((managerAchieved / targetValue) * 100) : 0;
  const difference = managerPercentage - employeePercentage;
  const autoRating = calculateRatingFromAchievement(managerPercentage);

  // Handle percentage change - convert back to achieved value
  const handlePercentageChange = (newPercentage: number) => {
    const newAchievedValue = (newPercentage / 100) * targetValue;
    onManagerChange?.(newAchievedValue);
    
    // Auto-update rating based on new percentage
    const newRating = calculateRatingFromAchievement(newPercentage);
    onRatingChange?.(newRating);
  };

  const getRatingLabel = (rating: number) => {
    switch (rating) {
      case 5: return 'Exceptional';
      case 4: return 'Exceeds Expectations';
      case 3: return 'Meets Expectations';
      case 2: return 'Needs Improvement';
      case 1: return 'Unsatisfactory';
      default: return '';
    }
  };

  const getRatingColor = (rating: number) => {
    switch (rating) {
      case 5: return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
      case 4: return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 3: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      case 2: return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
      case 1: return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      default: return '';
    }
  };

  return (
    <div className="space-y-4 p-3 rounded-lg border bg-muted/30">
      <div className="text-sm font-medium text-muted-foreground">Achievement vs Target: {targetValue}</div>
      
      {/* Employee's claimed achievement - read only */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Employee's Claimed</span>
          <span className="font-medium text-primary">
            {employeePercentage}%
          </span>
        </div>
        <Progress value={employeePercentage} className="h-3" />
      </div>

      {/* Manager's assessment - editable */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Your Assessment</span>
          <span className="font-medium text-green-600 dark:text-green-400">
            {managerPercentage}%
          </span>
        </div>
        {disabled ? (
          <Progress 
            value={managerPercentage} 
            className="h-3 [&>div]:bg-green-500 " 
          />
        ) : (
          <Slider
            value={[managerPercentage]}
            onValueChange={(values) => handlePercentageChange(values[0])}
            max={100}
            min={0}
            step={1}
            disabled={disabled}
            className="[&_[data-radix-slider-range]]:bg-green-500 [&_[data-radix-slider-thumb]]:border-green-500"
          />
        )}
      </div>

      {/* Auto-calculated rating indicator */}
          {/* Combined rating and difference indicator */}
      {showAutoRating && (
        <div className={cn(
          "rounded-lg overflow-hidden border",
          getRatingColor(autoRating)
        )}>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg",
                autoRating >= 4 ? "bg-white/30" : "bg-black/10"
              )}>
                {autoRating}
              </div>
              <div>
                <div className="font-semibold text-sm">{getRatingLabel(autoRating)}</div>
                <div className="text-xs opacity-75">Auto-suggested rating</div>
              </div>
            </div>
            {difference !== 0 && (
              <div className={cn(
                "text-xs font-medium px-2 py-1 rounded-full",
                difference > 0 
                  ? "bg-green-600/20 text-green-700 dark:text-green-300" 
                  : "bg-red-600/20 text-red-700 dark:text-red-300"
              )}>
                {difference > 0 ? `+${difference}%` : `${difference}%`} vs claim from employee
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { parseNumericTarget };
