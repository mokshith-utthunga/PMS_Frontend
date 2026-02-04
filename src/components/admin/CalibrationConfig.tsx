import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface CalibrationRule {
  threshold: number; // Threshold value (interpreted based on metric type)
  rating: number; // Rating value (1-5)
}

interface CalibrationConfigProps {
  value: CalibrationRule[] | null | undefined;
  onChange: (calibration: CalibrationRule[] | null) => void;
  disabled?: boolean;
  targetValue?: string; // For display purposes
  metricType?: string; // 'number', 'percentage', 'milestone', 'qualitative'
}

// Single default row for new calibration
const EMPTY_RULE: CalibrationRule = { threshold: 0, rating: 1 };

/**
 * Validate calibration rules - call this before saving
 * Returns array of error messages, empty if valid
 */
export function validateCalibrationRules(rules: CalibrationRule[] | null | undefined): string[] {
  const errors: string[] = [];
  
  if (!rules || rules.length === 0) return errors;

  // Check for duplicate thresholds
  const thresholds = rules.map(r => r.threshold);
  const duplicates = thresholds.filter((t, i) => thresholds.indexOf(t) !== i);
  if (duplicates.length > 0) {
    errors.push(`Duplicate threshold values: ${[...new Set(duplicates)].join(', ')}`);
  }

  // Validate threshold (must be non-negative)
  rules.forEach((rule, index) => {
    if (rule.threshold < 0) {
      errors.push(`Rule ${index + 1}: Threshold must be non-negative`);
    }
  });

  // Validate rating range (1-5)
  rules.forEach((rule, index) => {
    if (rule.rating < 1 || rule.rating > 5 || !Number.isInteger(rule.rating)) {
      errors.push(`Rule ${index + 1}: Rating must be an integer between 1 and 5`);
    }
  });

  return errors;
}

/**
 * Sort calibration rules by threshold descending - call before saving
 */
export function sortCalibrationRules(rules: CalibrationRule[] | null | undefined): CalibrationRule[] | null {
  if (!rules || rules.length === 0) return null;
  return [...rules].sort((a, b) => b.threshold - a.threshold);
}

export function CalibrationConfig({
  value,
  onChange,
  disabled = false,
  targetValue,
  metricType = 'number',
}: CalibrationConfigProps) {
  const [rules, setRules] = useState<CalibrationRule[]>(
    value && value.length > 0 ? [...value] : []
  );

  useEffect(() => {
    if (value && value.length > 0) {
      setRules([...value]);
    } else if (value === null || value === undefined) {
      setRules([]);
    }
  }, [value]);

  // Preview of sorted rules for display
  const sortedRulesPreview = useMemo(() => {
    if (rules.length === 0) return [];
    return [...rules].sort((a, b) => b.threshold - a.threshold);
  }, [rules]);

  // Generate range descriptions for preview in the new format
  // Example: <50 rating 1, 51-60 rating 2, 61-75 rating 3, etc.
  const getRangeDescriptions = useMemo(() => {
    if (rules.length === 0) return [];
    
    const descriptions: { range: string; rating: number }[] = [];
    
    // Sort by threshold ascending for range generation
    const ascendingRules = [...rules].sort((a, b) => a.threshold - b.threshold);
    
    for (let i = 0; i < ascendingRules.length; i++) {
      const current = ascendingRules[i];
      const previous = ascendingRules[i - 1];
      
      if (i === 0) {
        // First (lowest) threshold: < threshold
        descriptions.push({
          range: `< ${current.threshold}`,
          rating: current.rating,
        });
      } else {
        // Middle and last thresholds: previous_threshold+1 - current_threshold
        const startValue = previous.threshold + 1;
        const endValue = current.threshold;
        
        if (startValue === endValue) {
          // If start and end are the same, just show the value
          descriptions.push({
            range: `${startValue}`,
            rating: current.rating,
          });
        } else {
          descriptions.push({
            range: `${startValue}-${endValue}`,
            rating: current.rating,
          });
        }
      }
    }
    
    return descriptions;
  }, [rules]);

  // Determine threshold label based on metric type
  const getThresholdLabel = () => {
    switch (metricType) {
      case 'percentage':
        return 'Threshold (%)';
      case 'number':
        return 'Threshold (Value)';
      case 'milestone':
        return 'Threshold (%)';
      default:
        return 'Threshold';
    }
  };

  // Get placeholder based on metric type
  const getThresholdPlaceholder = () => {
    switch (metricType) {
      case 'percentage':
        return 'e.g., 70';
      case 'number':
        return targetValue ? `e.g., ${targetValue}` : 'e.g., 100';
      default:
        return 'Enter value';
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

  const updateRule = (index: number, field: keyof CalibrationRule, newValue: number) => {
    const updatedRules = [...rules];
    updatedRules[index] = { ...updatedRules[index], [field]: newValue };
    setRules(updatedRules);
    onChange(updatedRules.length > 0 ? updatedRules : null);
  };

  const addRule = () => {
    const newRule: CalibrationRule = { ...EMPTY_RULE };
    const updatedRules = [...rules, newRule];
    setRules(updatedRules);
    onChange(updatedRules);
  };

  const removeRule = (index: number) => {
    const updatedRules = rules.filter((_, i) => i !== index);
    setRules(updatedRules);
    onChange(updatedRules.length > 0 ? updatedRules : null);
  };

  const clearAll = () => {
    setRules([]);
    onChange(null);
  };

  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Calibration Settings</CardTitle>
            <CardDescription>
              Define thresholds and their corresponding ratings. 
              {targetValue && ` Target: ${targetValue}`}
            </CardDescription>
          </div>
          {!disabled && rules.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearAll}
              aria-label="Clear all calibration rules"
            >
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rules.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm mb-3">No calibration rules defined.</p>
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRule}
                aria-label="Add first calibration rule"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Calibration Rule
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground mb-2">
                <div className="col-span-5">{getThresholdLabel()}</div>
                <div className="col-span-5">Rating (1-5)</div>
                <div className="col-span-2">Actions</div>
              </div>

              {rules.map((rule, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 items-start"
                  role="group"
                  aria-label={`Calibration rule ${index + 1}`}
                >
                  <div className="col-span-5 space-y-1">
                    <Label htmlFor={`threshold-${index}`} className="sr-only">
                      Threshold for rule {index + 1}
                    </Label>
                    <Input
                      id={`threshold-${index}`}
                      type="number"
                      min="0"
                      step="any"
                      value={rule.threshold}
                      onChange={(e) => updateRule(index, 'threshold', parseFloat(e.target.value) || 0)}
                      disabled={disabled}
                      placeholder={getThresholdPlaceholder()}
                    />
                  </div>

                  <div className="col-span-5 space-y-1">
                    <Label htmlFor={`rating-${index}`} className="sr-only">
                      Rating value for rule {index + 1}
                    </Label>
                    <Input
                      id={`rating-${index}`}
                      type="number"
                      min="1"
                      max="5"
                      step="1"
                      value={rule.rating}
                      onChange={(e) => updateRule(index, 'rating', parseInt(e.target.value) || 1)}
                      disabled={disabled}
                      placeholder="1-5"
                    />
                  </div>

                  <div className="col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRule(index)}
                      disabled={disabled}
                      aria-label={`Remove calibration rule ${index + 1}`}
                      className="h-9 w-9"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRule}
                className="w-full"
                aria-label="Add new calibration rule"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Rule
              </Button>
            )}

          </>
        )}

      </CardContent>
    </Card>
  );
}
