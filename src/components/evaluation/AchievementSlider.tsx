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
            // step={0.01}
            value={numericAchievedValue}
            onChange={(e) => {
              // Handle empty string as 0, but preserve 0 as a valid value
              const inputValue = e.target.value;
              if (inputValue === '' || inputValue === null || inputValue === undefined) {
                handleNumberChange(0);
                return;
              }
              const value = parseFloat(inputValue);
              // Check for NaN explicitly, but allow 0 as a valid number
              if (isNaN(value)) {
                handleNumberChange(0);
                return;
              }
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
    // Use actual achieved value if provided (for number metrics), otherwise use percentage
    // Explicitly handle 0 as a valid value (not undefined)
    const rawValue = achievedValue !== undefined ? achievedValue : valueOrPercentage;
    
    // Ensure compareValue is a number (handle string inputs and ensure 0 is preserved)
    let compareValue: number;
    if (typeof rawValue === 'number') {
      compareValue = rawValue;
    } else if (typeof rawValue === 'string') {
      compareValue = parseFloat(rawValue);
    } else {
      compareValue = Number(rawValue);
    }
    
    // Check if conversion resulted in NaN (0 is a valid number, so only check for NaN)
    if (isNaN(compareValue)) return 1; // Fallback to rating 1 if invalid
    
    // Use the same range-based logic as calculateRatingFromCalibration
    // Sort by threshold ascending to match range display logic
    const sortedRules = [...calibration].sort((a, b) => a.threshold - b.threshold);
    
    if (sortedRules.length === 0) return 1;
    
    // Handle value exactly equal to first threshold (including 0)
    // If first threshold is 0 and value is 0, return that threshold's rating
    if (compareValue === sortedRules[0].threshold) {
      return sortedRules[0].rating;
    }
    
    // Check if value is below first threshold
    // If first threshold is > 0 and value is 0, return first threshold's rating
    if (compareValue < sortedRules[0].threshold) {
      return sortedRules[0].rating;
    }
    
    // Check each range from second threshold onwards
    for (let i = 1; i < sortedRules.length; i++) {
      const previousRule = sortedRules[i - 1];
      const currentRule = sortedRules[i];
      
      // Range is from (previous_threshold + 1) to current_threshold (inclusive)
      const rangeStart = previousRule.threshold + 1;
      const rangeEnd = currentRule.threshold;
      
      // Check if value is within this range (inclusive)
      if (compareValue >= rangeStart && compareValue <= rangeEnd) {
        return currentRule.rating;
      }
      
      // Handle values between thresholds: if value is > previous threshold but < rangeStart,
      // it should get the rating of the previous threshold
      // Example: if thresholds are 85 and 90, and value is 85.5:
      // - 85.5 > 85 (previous threshold)
      // - 85.5 < 86 (rangeStart = 85 + 1)
      // - So it should get the rating of threshold 85
      if (compareValue > previousRule.threshold && compareValue < rangeStart) {
        return previousRule.rating;
      }
    }
    
    // Handle values exactly at first threshold: they get the second threshold's rating
    // (since they're not < first_threshold and not in the 51-60 range)
    if (sortedRules.length > 1 && compareValue === sortedRules[0].threshold) {
      return sortedRules[1].rating;
    }
    
    // Handle values between the highest threshold and the next range start
    // If value is > highest threshold but < (highest threshold + 1), it should get the highest threshold's rating
    const highestRule = sortedRules[sortedRules.length - 1];
    if (compareValue > highestRule.threshold) {
      // Check if there's a gap - if value is just slightly above highest threshold,
      // it should still get the highest threshold's rating
      // Otherwise, if it's significantly above, use highest rating
      return highestRule.rating;
    }
    
    // Handle values exactly at the highest threshold: they get that threshold's rating
    if (compareValue === highestRule.threshold) {
      return highestRule.rating;
    }
    
    // Fallback: use highest rating (shouldn't reach here in normal cases)
    return highestRule.rating;
  }
  
  // Fallback to percentage-based rating if no calibration
  if (valueOrPercentage >= 100) return 5;
  if (valueOrPercentage >= 80) return 4;
  if (valueOrPercentage >= 60) return 3;
  if (valueOrPercentage >= 40) return 2;
  return 1;
}


export function getMaxPercentageFromCalibration(calibration?: CalibrationRule[] | null): number {
  if (!calibration || calibration.length === 0) return 200; // Default
  
  const highestThreshold = Math.max(...calibration.map(r => r.threshold));
  // Always allow at least 200% to ensure managers can rate above target
  // If highest threshold is already above 200, use that with a buffer
  return Math.max(200, Math.ceil(highestThreshold * 1.2));
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

  // Convert to numbers, handling string inputs and null/undefined
  const numericEmployeeAchieved = typeof employeeAchieved === 'number' 
    ? employeeAchieved 
    : (typeof employeeAchieved === 'string' ? parseFloat(employeeAchieved) || 0 : 0);
  const numericManagerAchieved = typeof managerAchieved === 'number' 
    ? managerAchieved 
    : (typeof managerAchieved === 'string' ? parseFloat(managerAchieved) || 0 : 0);
  
  const employeePercentage = targetValue > 0 && !isNaN(numericEmployeeAchieved) 
    ? Math.round((numericEmployeeAchieved / targetValue) * 100) 
    : 0;
  const managerPercentage = targetValue > 0 && !isNaN(numericManagerAchieved) 
    ? Math.round((numericManagerAchieved / targetValue) * 100) 
    : 0;
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
    console.log('new=>Value', newValue);
    
    // Auto-update rating based on actual achieved value when calibration exists
    const newRating = calculateRatingFromAchievement(
      targetValue > 0 ? (newValue / targetValue) * 100 : 0, 
      calibration, 
      newValue
    );
    console.log('new=>Rating', newRating);
    onRatingChange?.(newRating);
  };

  // Handle number input change for employee
  const handleEmployeeNumberChange = (newValue: number) => {
    onEmployeeChange?.(newValue);
  };
  
  // Calculate max value for number input ONLY (not used for percentage sliders)
  // For number-type metrics with calibration, thresholds are absolute values, not percentages
  // So we need to use the highest threshold value, not a percentage of target
  // NOTE: This maxValue is ONLY used for number input fields, percentage sliders use maxPercentage
  let maxValue: number;
  if (isNumberType && calibration && calibration.length > 0) {
    // For number metrics with calibration, use the highest threshold + buffer
    // This ensures managers can enter values needed for all rating levels
    // This ONLY affects number input fields, not percentage-based sliders
    const highestThreshold = Math.max(...calibration.map(r => r.threshold));
    // Use highest threshold + 2 as buffer, or at least 1.5x the target, whichever is higher
    maxValue = Math.max(
      Math.ceil(highestThreshold + 2),
      Math.ceil(targetValue * 1.5)
    );
  } else {
    // For percentage-based sliders or number inputs without calibration, use percentage of target
    maxValue = Math.round((maxPercentage / 100) * targetValue);
  }

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
      case 5: return 'text-purple-600 bg-purple-100 ';
      case 4: return 'text-green-600 bg-green-100 ';
      case 3: return 'text-blue-600 bg-blue-100 ';
      case 2: return 'text-orange-600 bg-orange-100 ';
      case 1: return 'text-red-600 bg-red-100 ';
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
              {employeeAchieved}%
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
              // step={0.01}
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
                {typeof managerAchieved === 'number' ? managerAchieved.toFixed(1) : '0.0'}%
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
              // step={0.01}
              value={numericManagerAchieved}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                const clampedValue = Math.max(0, Math.min(maxValue, value));
                console.log('clampedValue', clampedValue, 'maxValue', maxValue, 'value', value,"manager",managerAchieved);
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
              value={managerAchieved} 
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
                  target
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
