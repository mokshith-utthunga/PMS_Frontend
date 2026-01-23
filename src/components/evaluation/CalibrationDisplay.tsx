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

/**
 * Calculate rating from calibration rules based on achieved value
 * This is the core function for deriving KPI rating from calibration
 */
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

  // Sort by threshold descending
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

  // Generate range descriptions
  const rangeDescriptions = useMemo(() => {
    const descriptions: { range: string; rating: number; isFallback?: boolean }[] = [];
    
    for (let i = 0; i < sortedRules.length; i++) {
      const current = sortedRules[i];
      const next = sortedRules[i + 1];
      const unit = metricType === 'percentage' ? '%' : '';
      
      if (i === 0) {
        // Highest threshold: >= threshold
        descriptions.push({
          range: `≥ ${current.threshold}${unit}`,
          rating: current.rating,
        });
      }
      
      if (next) {
        // Middle ranges: >= next.threshold and < current.threshold
        descriptions.push({
          range: `≥ ${next.threshold}${unit} and < ${current.threshold}${unit}`,
          rating: next.rating,
        });
      }
    }
    
    // Below lowest threshold (fallback)
    const lowestRule = sortedRules[sortedRules.length - 1];
    if (lowestRule) {
      const unit = metricType === 'percentage' ? '%' : '';
      descriptions.push({
        range: `< ${lowestRule.threshold}${unit}`,
        rating: lowestRule.rating,
        isFallback: true,
      });
    }
    
    return descriptions;
  }, [sortedRules, metricType]);

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

  // Check if the current achievement falls in a specific range
  const isCurrentRange = (desc: { range: string; rating: number; isFallback?: boolean }) => {
    if (achievedValue === null || achievedValue === undefined || currentRating === null) return false;
    
    // If it's a fallback and we didn't match any threshold
    if (desc.isFallback && matchedThreshold === null) return true;
    
    // Otherwise check if rating matches and it's not fallback
    if (!desc.isFallback && currentRating === desc.rating) {
      // Make sure this is the correct range by checking the threshold
      if (matchedThreshold !== null) {
        // Check if the range string contains the matched threshold
        return desc.range.includes(`≥ ${matchedThreshold}`);
      }
    }
    
    return false;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Calibration Scale</CardTitle>
        <CardDescription>
          Rating thresholds for this KPI.
          {targetValue && (
            <span className="block mt-1">Target: <strong>{targetValue}</strong></span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Achievement result */}
        {achievedValue !== null && achievedValue !== undefined && currentRating !== null && (
          <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="text-sm">
              <span className="text-muted-foreground">Your achievement: </span>
              <span className="font-bold">{achievedValue}{metricType === 'percentage' ? '%' : ''}</span>
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
        )}

        {/* Range breakdown */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground mb-2">Rating Ranges</div>
          {rangeDescriptions.map((desc, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-2 rounded-md text-sm ${
                isCurrentRange(desc) 
                  ? 'bg-primary/10 border border-primary ring-1 ring-primary/20' 
                  : 'bg-muted/50'
              }`}
              role="row"
              aria-label={`Achievement ${desc.range} gets rating ${desc.rating}`}
            >
              <span className={`font-mono ${desc.isFallback ? 'text-muted-foreground italic' : ''}`}>
                {desc.range}
                {desc.isFallback && <span className="text-xs ml-1">(fallback)</span>}
              </span>
              <Badge variant="secondary" className={getRatingColor(desc.rating)}>
                {desc.rating}
              </Badge>
            </div>
          ))}
        </div>
        
        <p className="text-xs text-muted-foreground mt-4">
          <strong>How it works:</strong> Ratings are determined by finding the highest threshold that your achievement meets or exceeds (≥). 
          If your achievement is below all thresholds, the lowest defined rating is applied.
        </p>
      </CardContent>
    </Card>
  );
}
