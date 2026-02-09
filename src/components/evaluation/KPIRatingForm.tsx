// KPI Rating Form for Self Evaluation
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Star } from 'lucide-react';
import { AchievementSlider, parseNumericTarget } from '@/components/evaluation/AchievementSlider';
import { CalibrationDisplay, calculateRatingFromCalibration } from '@/components/evaluation/CalibrationDisplay';
import { KPIEvidenceUpload } from './KPIEvidenceUpload';
import type { Goal, RatingScale } from '@/types';
import type { GoalRating } from '@/hooks/useEvaluationsData';

interface KPIRatingFormProps {
  kpi: Goal;
  rating: GoalRating | undefined;
  ratingScales: RatingScale[];
  canEdit: boolean;
  onRatingChange: (goalId: string, field: keyof GoalRating, value: unknown) => void;
  empCode?: string;
  quarter?: number;
  year?: number;
  employeeId?: string;
  rejection?: any; // Rejection data for this KPI
}

export function KPIRatingForm({
  kpi,
  rating,
  ratingScales,
  canEdit,
  onRatingChange,
  empCode,
  quarter,
  year,
  employeeId,
  rejection,
}: KPIRatingFormProps) {
  // Parse existing evidence files from rating
  const parseEvidenceFiles = (evidence: string | null | undefined): string[] => {
    if (!evidence) return [];
    try {
      const parsed = JSON.parse(evidence);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      // Not JSON, treat as text (backward compatibility)
    }
    return [];
  };

  const [evidenceFiles, setEvidenceFiles] = useState<string[]>(() => 
    parseEvidenceFiles(rating?.evidence)
  );

  // Update evidence files when rating changes
  useEffect(() => {
    const files = parseEvidenceFiles(rating?.evidence);
    setEvidenceFiles(files);
  }, [rating?.evidence]);
  const numericTarget = parseNumericTarget(kpi.target_value);
  console.log('currentAchieved',typeof rating?.achieved_value, rating?.achieved_value);
  // Explicitly handle 0 as a valid value (not undefined/null)
  // If achieved_value is explicitly 0, use it; otherwise default to 0 if undefined/null
  const currentAchieved = rating?.achieved_value !== undefined && rating?.achieved_value !== null 
    ? rating.achieved_value 
    : 0;

  // Auto-calculate rating from calibration when achievement changes
  const calculatedRating = useMemo(() => {
    if (kpi.calibration && kpi.calibration.length > 0) {
      // Explicitly pass 0 as a number, not as falsy
      const valueToCalculate = currentAchieved === 0 ? 0 : currentAchieved;
      const rating = calculateRatingFromCalibration(valueToCalculate, kpi.calibration);

      return rating;
    }
    return null;
  }, [currentAchieved, kpi.calibration]);

  // Update self_rating automatically when calculated rating changes
  useEffect(() => {
    if (calculatedRating !== null && calculatedRating !== rating?.self_rating) {
      onRatingChange(kpi.id, 'self_rating', calculatedRating);
    }
  }, [calculatedRating, kpi.id, onRatingChange, rating?.self_rating]);

  // Get rating label and color
  const getRatingLabel = (ratingValue: number | null) => {
    if (ratingValue === null) return null;
    const scale = ratingScales.find(s => s.value === ratingValue);
    return scale ? scale.name : `Rating ${ratingValue}`;
  };

  const getRatingColor = (ratingValue: number | null) => {
    if (ratingValue === null) return '';
    switch (ratingValue) {
      case 5: return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 4: return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 3: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 2: return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 1: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return '';
    }
  };

  const isRejected = rejection && !rejection.resubmitted_at;

  return (
    <div className={`border rounded-lg p-4 space-y-4 ${isRejected ? 'border-orange-300 bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
      {/* Show rejection feedback if rejected */}
      {isRejected && (
        <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            <div className="font-semibold mb-1">Rejected by Manager</div>
            <div className="text-sm">{rejection.rejection_reason}</div>
            <div className="text-xs mt-2 italic">
              Please review the feedback above, update this KPI, and resubmit your evaluation.
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary">KPI</Badge>
            <span className="text-sm text-muted-foreground">Weight: {kpi.weight}%</span>
            {isRejected && (
              <Badge variant="destructive" className="text-xs">
                Rejected
              </Badge>
            )}
          </div>
          <h4 className="font-medium">{kpi.title}</h4>
          {kpi.description && (
            <p className="text-sm text-muted-foreground mt-1">{kpi.description}</p>
          )}
          {kpi.metric_type && (
            <p className="text-sm mt-1">
              <span className="text-muted-foreground">Metric Type: </span>
              {kpi.metric_type}
            </p>
          )}
          {kpi.target_value && (
            <p className="text-sm mt-1">
              <span className="text-muted-foreground">Target: </span>
              {kpi.target_value}
            </p>
          )}
        </div>
        
        {/* Display calculated rating prominently */}
        {calculatedRating !== null && calculatedRating !== undefined && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1 justify-end">
              <Star className="h-3 w-3" />
              Your Rating
            </div>
            <Badge className={`text-lg px-3 py-1 ${getRatingColor(calculatedRating)}`}>
              {calculatedRating} - {getRatingLabel(calculatedRating)}
            </Badge>
          </div>
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
            metricType={kpi.metric_type || null}
          />
        </div>
      )}

      {/* Calibration Display - shows how rating is calculated */}
      {kpi.calibration && kpi.calibration.length > 0 && (
        <CalibrationDisplay
          calibration={kpi.calibration}
          targetValue={kpi.target_value}
          achievedValue={currentAchieved}
          metricType={kpi.metric_type}
          className="mt-4"
        />
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

      {/* Evidence - File Upload */}
      {empCode && quarter && year && employeeId ? (<>
        {console.log('empCode', empCode, 'quarter', quarter, 'year', year, 'employeeId', employeeId)}
        <KPIEvidenceUpload
          goalId={kpi.id}
          empCode={empCode}
          quarter={quarter}
          year={year}
          employeeId={employeeId}
          canEdit={canEdit}
          existingFiles={evidenceFiles}
          onFilesChange={(files) => {
            setEvidenceFiles(files);
            // Store file paths as JSON in evidence field for backward compatibility
            const evidenceJson = files.length > 0 ? JSON.stringify(files) : null;
            onRatingChange(kpi.id, 'evidence', evidenceJson);
          }}
        />
        </>
      ) : (
        // Fallback to textarea if props not available (backward compatibility)
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
      )}

      {/* Show rating info if no calibration configured */}
      {(!kpi.calibration || kpi.calibration.length === 0) && (
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-sm text-muted-foreground">
            <Star className="h-4 w-4 inline mr-1" />
            No calibration rules configured for this KPI. Rating will be calculated based on achievement percentage.
          </p>
          {currentAchieved > 0 && (
            <div className="mt-2">
              <span className="text-sm font-medium">Current Rating: </span>
              <Badge className={getRatingColor(rating?.self_rating ?? null)}>
                {rating?.self_rating ?? '-'}
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
