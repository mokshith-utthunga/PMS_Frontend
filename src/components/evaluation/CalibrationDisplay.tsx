import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalibrationRule } from '@/components/admin/CalibrationConfig';

interface CalibrationDisplayProps {
  calibration: CalibrationRule[] | null | undefined;
  targetValue?: string | null;
  achievedValue?: number | null;
  metricType?: string;
  className?: string;
}


export function calculateRatingFromCalibration(
  achievedValue: number | null | undefined,
  calibration: CalibrationRule[] | null | undefined
): number | null {
  if (!calibration || calibration.length === 0) return null;
  // Explicitly check for null/undefined, but allow 0 as a valid value
  if (achievedValue === null || achievedValue === undefined) return null;
  
  // Ensure achievedValue is a number (handle string inputs)
  // Explicitly handle 0 as a valid number (not falsy)
  let numericValue: number;
  if (typeof achievedValue === 'number') {
    numericValue = achievedValue;
  } else if (typeof achievedValue === 'string') {
    numericValue = parseFloat(achievedValue);
  } else {
    numericValue = Number(achievedValue);
  }
  
  // Check if conversion resulted in NaN (0 is a valid number, so only check for NaN)
  if (isNaN(numericValue)) return null;
  
  // Sort by threshold ascending to match range display logic
  const sortedRules = [...calibration].sort((a, b) => a.threshold - b.threshold);
  
  console.log('calculateRatingFromCalibration: after sorting', {
    numericValue,
    sortedRules: sortedRules.map(r => ({ threshold: r.threshold, rating: r.rating })),
    firstRule: sortedRules[0] ? { threshold: sortedRules[0].threshold, rating: sortedRules[0].rating } : null
  });
  
  if (sortedRules.length === 0) return null;
  
  // Find matching rating based on range logic (matching the display)
  // Ranges are: < first_threshold, (first+1)-second_threshold, (second+1)-third_threshold, etc.
  // Example: thresholds [50, 60, 75, 90, 100] with ratings [1, 2, 3, 4, 5]
  // Ranges: <50→1, 51-60→2, 61-75→3, 76-90→4, 91-100→5
  
  // Handle value exactly equal to first threshold (including 0)
  // If first threshold is 0 and value is 0, return that threshold's rating
  if (numericValue === sortedRules[0].threshold) {
    console.log('calculateRatingFromCalibration: value equals first threshold', {
      numericValue,
      firstThreshold: sortedRules[0].threshold,
      firstRating: sortedRules[0].rating
    });
    return sortedRules[0].rating;
  }
  
  // Check if value is below first threshold
  // If first threshold is > 0 and value is 0, return first threshold's rating
  if (numericValue < sortedRules[0].threshold) {
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
    if (numericValue >= rangeStart && numericValue <= rangeEnd) {
      return currentRule.rating;
    }
    
    // Handle values between thresholds: if value is > previous threshold but < rangeStart,
    // it should get the rating of the previous threshold
    // Example: if thresholds are 85 and 90, and value is 85.5:
    // - 85.5 > 85 (previous threshold)
    // - 85.5 < 86 (rangeStart = 85 + 1)
    // - So it should get the rating of threshold 85
    if (numericValue > previousRule.threshold && numericValue < rangeStart) {
      return previousRule.rating;
    }
  }
  
  // Handle values exactly at first threshold: they get the second threshold's rating
  // (since they're not < first_threshold and not in the 51-60 range)
  if (sortedRules.length > 1 && numericValue === sortedRules[0].threshold) {
    return sortedRules[1].rating;
  }
  
  // Handle values between the highest threshold and the next range start
  // If value is > highest threshold but < (highest threshold + 1), it should get the highest threshold's rating
  const highestRule = sortedRules[sortedRules.length - 1];
  if (numericValue > highestRule.threshold) {
    // Check if there's a gap - if value is just slightly above highest threshold,
    // it should still get the highest threshold's rating
    // Otherwise, if it's significantly above, use highest rating
    return highestRule.rating;
  }
  
  // Handle values exactly at the highest threshold: they get that threshold's rating
  if (numericValue === highestRule.threshold) {
    return highestRule.rating;
  }
  
  // Fallback: use highest rating (shouldn't reach here in normal cases)
  return highestRule.rating;
}

export function CalibrationDisplay({
  calibration,
  targetValue,
  achievedValue,
  metricType = 'number',
  className,
}: CalibrationDisplayProps) {
  if (!calibration || calibration.length === 0) {
    return null;
  }

  // Use the same calculation function for consistency
  const currentRating = calculateRatingFromCalibration(achievedValue, calibration);
  const matchedThreshold: number | null = null; // Not used in display, kept for compatibility

  // Generate range descriptions in the new format
  // Example: <50 rating 1, 51-60 rating 2, 61-75 rating 3, etc.
  const rangeDescriptions = useMemo(() => {
    const descriptions: { range: string; rating: number; isFallback?: boolean }[] = [];
    
    if (!calibration || calibration.length === 0) return descriptions;
    
    // Sort by threshold ascending for range generation
    const ascendingRules = [...calibration].sort((a, b) => a.threshold - b.threshold);
    const unit = metricType === 'percentage' ? '%' : '';
    
    for (let i = 0; i < ascendingRules.length; i++) {
      const current = ascendingRules[i];
      const previous = ascendingRules[i - 1];
      
      if (i === 0) {
        // First (lowest) threshold: < threshold
        descriptions.push({
          range: `< ${current.threshold}${unit}`,
          rating: current.rating,
          isFallback: true,
        });
      } else {
        // Middle and last thresholds: previous_threshold+1 - current_threshold
        const startValue = previous.threshold + 1;
        const endValue = current.threshold;
        
        if (startValue === endValue) {
          // If start and end are the same, just show the value
          descriptions.push({
            range: `${startValue}${unit}`,
            rating: current.rating,
          });
        } else {
          descriptions.push({
            range: `${startValue}-${endValue}${unit}`,
            rating: current.rating,
          });
        }
      }
    }
    
    return descriptions;
  }, [calibration, metricType]);

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
      case 5: return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 4: return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 3: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 2: return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 1: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return '';
    }
  };
  const getRatingBorderColor = (rating: number) => {
    switch (rating) {
      case 5: return '#9333ea'; // purple-600
      case 4: return '#16a34a'; // green-600
      case 3: return '#2563eb'; // blue-600
      case 2: return '#ea580c'; // orange-600
      case 1: return '#dc2626'; // red-600
      default: return 'transparent';
    }
  };

  const isCurrentRange = (desc: { range: string; rating: number; isFallback?: boolean }) => {
    // Explicitly handle 0 as a valid value (not null/undefined)
    if (achievedValue === null || achievedValue === undefined || currentRating === null) return false;
    
    // Convert achievedValue to number to ensure proper comparison (handles string "0")
    const numericAchieved = typeof achievedValue === 'number' ? achievedValue : parseFloat(String(achievedValue));
    if (isNaN(numericAchieved)) return false;
    
    // Check if the achieved value falls within this range
    if (currentRating === desc.rating) {
      if (desc.isFallback) {
        // For fallback range (< threshold), check if value is below the lowest threshold
        const ascendingRules = [...calibration].sort((a, b) => a.threshold - b.threshold);
        if (ascendingRules.length > 0 && numericAchieved < ascendingRules[0].threshold) {
          return true;
        }
      } else {
        // Parse the range (e.g., "51-60%" or "61-75" or "< 50%")
        // Handle range format: "start-end" or "start-end%"
        const rangeMatch = desc.range.match(/(\d+)-(\d+)/);
        if (rangeMatch) {
          const start = parseFloat(rangeMatch[1]);
          const end = parseFloat(rangeMatch[2]);
          if (numericAchieved >= start && numericAchieved <= end) {
            return true;
          }
        } else {
          // Single value range (e.g., "50" or "50%")
          const valueMatch = desc.range.match(/(\d+)/);
          if (valueMatch) {
            const value = parseFloat(valueMatch[1]);
            if (Math.abs(numericAchieved - value) < 0.01) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Calibration Scale</CardTitle>
        <CardDescription className='flex justify-between items-center'>
          Rating thresholds for this KPI.
          {targetValue && (
            <span className="block mt-1">Target: <strong>{targetValue}</strong></span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent   >
        {/* {achievedValue !== null && achievedValue !== undefined && currentRating !== null && (
          <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="text-sm">
              <span className="text-muted-foreground">Your achievement: </span>
              <span className="font-medium">{achievedValue && achievedValue > 0 ? achievedValue.toFixed(2) : 0}{metricType === 'percentage' ? '%' : ''}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rating: </span>
              <Badge className={getRatingColor(currentRating)}>
                {currentRating} - {getRatingLabel(currentRating)}
              </Badge>
              {matchedThreshold === null && (
                <span className="text-xs text-muted-foreground">(below all thresholds)</span>
              )}
            </div>
          </div>
        )} */}

        {/* Range breakdown */}
        <div className='space-y-2' >
          <div className="text-xs font-medium text-muted-foreground mb-2">Rating Ranges</div>
          <div className='flex flex-row justify-between gap-2 items-center '>
          {rangeDescriptions.map((desc, index) => {
            const isCurrent = isCurrentRange(desc)
            const ratingColor = getRatingColor(desc.rating);
            return(
            <div
              key={index}
              className={`flex items-center justify-start gap-2 rounded-md text-sm p-1 ${
                isCurrentRange(desc) 
                  ? `${getRatingColor(desc.rating)} border-2 `
                  : 'bg-white/50 border'
              }`}
              style={isCurrentRange(desc)?{ borderColor:  getRatingBorderColor(desc.rating) }:undefined}
              role="row"
              aria-label={`Achievement ${desc.range} gets rating ${desc.rating}`}
            >
              <span className={`text-xs font-mono ${desc.isFallback ? 'text-muted-foreground italic' : ''}`}>
                {desc.range}
                {desc.isFallback && <span className="text-xs ml-1">(fallback)</span>}
              </span>
              <Badge variant="secondary" className={getRatingColor(desc.rating)}>
                {desc.rating}
              </Badge>
            </div>
            )
})}
          </div>
        </div>
        

      </CardContent>
    </Card>
  );
}
