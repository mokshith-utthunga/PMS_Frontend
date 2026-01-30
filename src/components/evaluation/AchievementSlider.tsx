import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AchievementSliderProps {
  targetValue: number;
  achievedValue: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  label: string;
  variant?: 'employee' | 'manager';
  showPercentage?: boolean;
  maxPercentage?: number; // Allow custom max percentage (default 150%)
  metricType?: string | null; // If "number", show number input instead of slider
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
  maxPercentage = 200, // Default max 150% for overachievement
  metricType,
}: AchievementSliderProps) {
  // Convert achievedValue to number, handling string inputs and null/undefined
  const numericAchievedValue = typeof achievedValue === 'number' 
    ? achievedValue 
    : (typeof achievedValue === 'string' ? parseFloat(achievedValue) || 0 : 0);
  
  const percentage = targetValue > 0 ? Math.round((numericAchievedValue / targetValue) * 100) : 0;
  const isManager = variant === 'manager';
  // Check if metricType is "number" (case-insensitive)
  const isNumberType = typeof metricType === 'string' && metricType.toLowerCase() === 'number';

  const handlePercentageChange = (newPercentage: number) => {
    const newAchievedValue = (newPercentage / 100) * targetValue;
    onChange?.(newAchievedValue);
  };

  const handleNumberChange = (newValue: number) => {
    onChange?.(newValue);
  };

  const displayPercentage = Math.min(percentage, 100);
  const isOverAchieved = percentage > 100;
  
  // Calculate max value for number input (allow overachievement up to maxPercentage)
  const maxValue = Math.round((maxPercentage / 100) * targetValue);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(
          "font-medium",
          isManager ? "text-[#00562c] dark:text-[#00562c]" : "text-primary",
          isOverAchieved && "text-purple-600 dark:text-purple-400"
        )}>
          {numericAchievedValue > 0 ? numericAchievedValue.toFixed(2) : '0.00'}
          {isOverAchieved && " 🎯"}
          {!isNumberType && displayPercentage && ` (Target: ${targetValue})`}
        </span>
      </div>
      
      {isNumberType ? (
        <div className="space-y-1">
          <Input
            type="number"
            min={0}
            max={maxValue}
            step={0.01}
            value={numericAchievedValue}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              const clampedValue = Math.max(0, Math.min(maxValue, value));
              handleNumberChange(clampedValue);
            }}
            disabled={disabled}
            placeholder="Enter achieved value"
            className={disabled ? "bg-muted cursor-not-allowed" : ""}
          />
          <div className="text-xs text-muted-foreground">
            Range: 0 to {maxValue} (Target: {targetValue})
          </div>
        </div>
      ) : disabled ? (
        <div className="relative">
          <Progress 
            value={displayPercentage} 
            className={cn(
              "h-3",
              "[&>div]:bg-[#00562c]",
              isOverAchieved && "[&>div]:bg-purple-500"
            )}
          />
          {isOverAchieved && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white drop-shadow">EXCEEDED</span>
            </div>
          )}
        </div>
      ) : (
        <>
          <Slider
            value={[percentage]}
            onValueChange={(values) => handlePercentageChange(values[0])}
            max={maxPercentage}
            min={0}
            step={1}
            disabled={disabled}
            className={cn(
             "[&_[data-radix-slider-range]]:bg-[#00562c] [&_[data-radix-slider-thumb]]:border-[#00562c]",
              percentage > 100 && "[&_[data-radix-slider-range]]:bg-purple-500 [&_[data-radix-slider-thumb]]:border-purple-500"
            )}
          />
          {maxPercentage > 100 && (
            <div className="relative h-1">
              <div 
                className="absolute w-0.5 h-2 bg-muted-foreground/50 -top-1"
                style={{ left: `${(100 / maxPercentage) * 100}%` }}
                title="100% Target"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export interface CalibrationRule {
  threshold: number;
  rating: number; 
}


export function calculateRatingFromAchievement(
  valueOrPercentage: number,
  calibration?: CalibrationRule[] | null,
  achievedValue?: number
): number {
  if (calibration && calibration.length > 0) {
    const compareValue = achievedValue !== undefined ? achievedValue : valueOrPercentage;
    
    const sortedRules = [...calibration].sort((a, b) => b.threshold - a.threshold);
    
    for (const rule of sortedRules) {
      if (compareValue >= rule.threshold) {
        return rule.rating;
      }
    }
    
    return sortedRules[sortedRules.length - 1]?.rating || 1;
  }
  
  if (valueOrPercentage >= 100) return 5;
  if (valueOrPercentage >= 80) return 4;
  if (valueOrPercentage >= 60) return 3;
  if (valueOrPercentage >= 40) return 2;
  return 1;
}


export function getMaxPercentageFromCalibration(calibration?: CalibrationRule[] | null): number {
  if (!calibration || calibration.length === 0) return 200; // Default
  
  const highestThreshold = Math.max(...calibration.map(r => r.threshold));
  return Math.max(100, Math.ceil(highestThreshold * 1.2));
}

export function DualAchievementSlider({
  targetValue,
  employeeAchieved,
  managerAchieved,
  onManagerChange,
  onRatingChange,
  disabled = false,
  showAutoRating = true,
  calibration,
  metricType,
  onEmployeeChange,
  canEditEmployee = false,
}: {
  targetValue: number;
  employeeAchieved: number;
  managerAchieved: number;
  onManagerChange?: (value: number) => void;
  onRatingChange?: (rating: number) => void;
  disabled?: boolean;
  showAutoRating?: boolean;
  calibration?: CalibrationRule[] | null;
  metricType?: string | null; // If "number", show number input instead of slider
  onEmployeeChange?: (value: number) => void; // For editing employee's claimed value
  canEditEmployee?: boolean; // Whether employee's value can be edited
}) {
  console.log('employeeAchieved', employeeAchieved);
  console.log('managerAchieved', managerAchieved);
  // Convert to numbers, handling string inputs and null/undefined
  const numericEmployeeAchieved = typeof employeeAchieved === 'number' 
    ? employeeAchieved 
    : (typeof employeeAchieved === 'string' ? parseFloat(employeeAchieved) || 0 : 0);
  const numericManagerAchieved = typeof managerAchieved === 'number' 
    ? managerAchieved 
    : (typeof managerAchieved === 'string' ? parseFloat(managerAchieved) || 0 : 0);
  
  const employeePercentage = targetValue > 0 ? Math.round((numericEmployeeAchieved / targetValue) * 100) : 0;
  const managerPercentage = targetValue > 0 ? Math.round((numericManagerAchieved / targetValue) * 100) : 0;
  const difference = managerPercentage - employeePercentage;
  // Check if metricType is "number" (case-insensitive)
  const isNumberType = typeof metricType === 'string' && metricType.toLowerCase() === 'number';
  
  const maxPercentage = getMaxPercentageFromCalibration(calibration);
  
  // Calculate rating: if calibration is provided, use actual achieved value; otherwise use percentage
  const autoRating = calculateRatingFromAchievement(managerPercentage, calibration, numericManagerAchieved);

  // Handle percentage change - convert back to achieved value
  const handlePercentageChange = (newPercentage: number) => {
    const newAchievedValue = (newPercentage / 100) * targetValue;
    onManagerChange?.(newAchievedValue);
    
    // Auto-update rating based on actual achieved value when calibration exists
    const newRating = calculateRatingFromAchievement(newPercentage, calibration, newAchievedValue);
    onRatingChange?.(newRating);
  };

  // Handle number input change for manager
  const handleManagerNumberChange = (newValue: number) => {
    onManagerChange?.(newValue);
    
    // Auto-update rating based on actual achieved value when calibration exists
    const newRating = calculateRatingFromAchievement(
      targetValue > 0 ? (newValue / targetValue) * 100 : 0, 
      calibration, 
      newValue
    );
    onRatingChange?.(newRating);
  };

  // Handle number input change for employee
  const handleEmployeeNumberChange = (newValue: number) => {
    onEmployeeChange?.(newValue);
  };
  
  // Calculate max value for number input (allow overachievement up to maxPercentage)
  const maxValue = Math.round((maxPercentage / 100) * targetValue);

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

  // Clamp display percentage for progress bar (0-100 visual range)
  const employeeDisplayPercentage = Math.min(employeePercentage, 100);
  const managerDisplayPercentage = Math.min(managerPercentage, 100);
  const isEmployeeOverAchieved = employeePercentage > 100;
  const isManagerOverAchieved = managerPercentage > 100;

  return (
    <div className="space-y-4 p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-muted-foreground">
          Achievement vs Target: {targetValue}
        </div>
        {maxPercentage > 100 && (
          <div className="text-xs text-muted-foreground">
            Max: {maxPercentage}%
          </div>
        )}
      </div>
      
      {/* Employee's claimed achievement */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Employee's Claimed</span>
          {!isNumberType && (
            <span className={cn(
              "font-medium text-primary",
              isEmployeeOverAchieved && "text-purple-600 dark:text-purple-400"
            )}>
              {employeePercentage}%
              {isEmployeeOverAchieved && " 🎯"}
            </span>
          )}
        </div>
        {isNumberType ? (
          <div className="space-y-1">
            <Input
              type="number"
              min={0}
              max={maxValue}
              step={0.01}
              value={numericEmployeeAchieved}
              onChange={(e) => {
                if (canEditEmployee && onEmployeeChange) {
                  const value = parseFloat(e.target.value) || 0;
                  const clampedValue = Math.max(0, Math.min(maxValue, value));
                  handleEmployeeNumberChange(clampedValue);
                }
              }}
              disabled={disabled || !canEditEmployee}
              placeholder="Enter achieved value"
              readOnly={!canEditEmployee}
              className={!canEditEmployee ? "bg-muted cursor-not-allowed" : ""}
            />
            <div className="text-xs text-muted-foreground">
              Range: 0 to {maxValue} (Target: {targetValue})
            </div>
          </div>
        ) : (
          <div className="relative">
            <Progress 
              value={employeeDisplayPercentage} 
              className={cn(
                "h-3",
                isEmployeeOverAchieved && "[&>div]:bg-purple-500"
              )} 
            />
            {isEmployeeOverAchieved && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white drop-shadow">EXCEEDED</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manager's assessment - editable */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Manager's Assessment</span>
          <span className={cn(
            "font-medium text-[#00562c] dark:text-[#00562c]",
            isManagerOverAchieved && "text-purple-600 dark:text-purple-400"
          )}>
            {isNumberType ? (
              <>
                {numericManagerAchieved > 0 ? numericManagerAchieved.toFixed(2) : '0.00'}
                {isManagerOverAchieved && " 🎯"}
                {` (Target: ${targetValue})`}
              </>
            ) : (
              <>
                {managerAchieved.toFixed(1)}%
                {isManagerOverAchieved && " 🎯"}
              </>
            )}
          </span>
        </div>
       { isNumberType ? (
          <div className="space-y-1">
            <Input
              type="number"
              min={0}
              max={maxValue}
              step={0.01}
              value={numericManagerAchieved}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                const clampedValue = Math.max(0, Math.min(maxValue, value));
                handleManagerNumberChange(clampedValue);
              }}
              disabled={disabled}
              placeholder="Enter achieved value"
            />
            <div className="text-xs text-muted-foreground">
              Range: 0 to {maxValue} (Target: {targetValue})
            </div>
          </div>
        ) :disabled ? (
          <div className="relative">
            <Progress 
              value={managerDisplayPercentage} 
              className={cn(
                "h-3 [&>div]:bg-[#00562c]",
                isManagerOverAchieved && "[&>div]:bg-purple-500"
              )} 
            />
            {isManagerOverAchieved && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white drop-shadow">EXCEEDED</span>
              </div>
            )}
          </div>
        ) :  (
          <>
            <Slider
              value={[managerPercentage]}
              onValueChange={(values) => handlePercentageChange(values[0])}
              max={maxPercentage}
              min={0}
              step={1}
              disabled={disabled}
              className={cn(
                "[&_[data-radix-slider-range]]:bg-[#00562c] [&_[data-radix-slider-thumb]]:border-[#00562c]",
                isManagerOverAchieved && "[&_[data-radix-slider-range]]:bg-purple-500 [&_[data-radix-slider-thumb]]:border-purple-500"
              )}
            />
            {maxPercentage > 100 && (
              <div className="relative h-0">
                <div 
                  className="absolute w-0.5 h-3 bg-muted-foreground/40 -top-3 rounded"
                  style={{ left: `${(100 / maxPercentage) * 100}%` }}
                  title="100% Target"
                />
                <div 
                  className="absolute text-[9px] text-muted-foreground -top-0.5"
                  style={{ left: `${(100 / maxPercentage) * 100}%`, transform: 'translateX(-50%)' }}
                >
                  100%
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Auto-calculated rating indicator */}
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
