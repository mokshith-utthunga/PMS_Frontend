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
  if (achievedValue === null || achievedValue === undefined) return null;
  
  // Sort by threshold descending
  const sortedRules = [...calibration].sort((a, b) => b.threshold - a.threshold);
  
  // Find matching rating - achieved value >= threshold
  for (const rule of sortedRules) {
    if (achievedValue >= rule.threshold) {
      return rule.rating;
    }
  }
  
  // If below all thresholds, use lowest rating as fallback
  return sortedRules[sortedRules.length - 1].rating;
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

  const sortedRules = [...calibration].sort((a, b) => b.threshold - a.threshold);

  // Find current rating based on achieved value
  let currentRating: number | null = null;
  let matchedThreshold: number | null = null;
  
  if (achievedValue !== null && achievedValue !== undefined) {
    // Find matching rating - compare achieved value directly to threshold
    for (const rule of sortedRules) {
      if (achievedValue >= rule.threshold) {
        currentRating = rule.rating;
        matchedThreshold = rule.threshold;
        break;
      }
    }
    // If no rule matches (below all thresholds), use lowest rating as fallback
    if (currentRating === null && sortedRules.length > 0) {
      currentRating = sortedRules[sortedRules.length - 1].rating;
      matchedThreshold = null; // Below all thresholds
    }
  }

  // Generate range descriptions in the new format
  // Example: <50 rating 1, 51-60 rating 2, 61-75 rating 3, etc.
  const rangeDescriptions = useMemo(() => {
    const descriptions: { range: string; rating: number; isFallback?: boolean }[] = [];
    
    if (sortedRules.length === 0) return descriptions;
    
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
    if (achievedValue === null || achievedValue === undefined || currentRating === null) return false;
    
    // Check if the achieved value falls within this range
    if (currentRating === desc.rating) {
      if (desc.isFallback) {
        // For fallback range (< threshold), check if value is below the lowest threshold
        const ascendingRules = [...calibration].sort((a, b) => a.threshold - b.threshold);
        if (ascendingRules.length > 0 && achievedValue < ascendingRules[0].threshold) {
          return true;
        }
      } else {
        // Parse the range (e.g., "51-60%" or "61-75" or "< 50%")
        // Handle range format: "start-end" or "start-end%"
        const rangeMatch = desc.range.match(/(\d+)-(\d+)/);
        if (rangeMatch) {
          const start = parseFloat(rangeMatch[1]);
          const end = parseFloat(rangeMatch[2]);
          if (achievedValue >= start && achievedValue <= end) {
            return true;
          }
        } else {
          // Single value range (e.g., "50" or "50%")
          const valueMatch = desc.range.match(/(\d+)/);
          if (valueMatch) {
            const value = parseFloat(valueMatch[1]);
            if (Math.abs(achievedValue - value) < 0.01) {
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
