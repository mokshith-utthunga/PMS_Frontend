
import { useState, useCallback } from 'react';
import { evaluationService, QuarterlySelfReviewData } from '@/services';
import { toasts } from '@/toasts';

export interface KpiRating {
  goal_id: string;
  achievement?: string;
  self_rating?: number;
  achieved_value?: number | null;
  target_value?: number | null;
  evidence?: string;
}

interface UseEvaluationOperationsProps {
  employeeId: string | null;
  cycleId: string | null;
  quarterlyReviews: Record<number, QuarterlySelfReviewData | null>;
  kpiRatings: Record<number, Record<string, KpiRating>>;
  kpis: { id: string }[];
  onSuccess: () => void;
  onRatingsUpdate?: (quarter: number, ratings: Record<string, KpiRating>) => void;
  periodType?: 'full_quarter' | 'pre_transition' | 'post_transition' | null;
  transitionId?: string | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
}

export function useEvaluationOperations({
  employeeId,
  cycleId,
  quarterlyReviews,
  kpiRatings,
  kpis,
  onSuccess,
  onRatingsUpdate,
  periodType,
  transitionId,
  periodStartDate,
  periodEndDate,
}: UseEvaluationOperationsProps) {
  const [saving, setSaving] = useState(false);

  const saveProgress = useCallback(
    async (
      quarter: number,
      overallComments: string,
      overallRating: number | undefined,
      setQuarterlyReviews: (fn: (prev: Record<number, QuarterlySelfReviewData | null>) => Record<number, QuarterlySelfReviewData | null>) => void
    ) => {
      if (!employeeId || !cycleId) return;

      setSaving(true);
      try {
        let review = quarterlyReviews[quarter];
        const allQuarterRatings = kpiRatings[quarter] || {};
        
        // Filter ratings to only include ratings for KPIs in the current period
        // This ensures we only save ratings for KPIs that are being displayed/evaluated
        const kpiIds = new Set(kpis.map(k => k.id));
        const currentRatings: Record<string, KpiRating> = {};
        Object.keys(allQuarterRatings).forEach(goalId => {
          if (kpiIds.has(goalId)) {
            currentRatings[goalId] = allQuarterRatings[goalId];
          }
        });

        // Log period info for debugging
        console.log('Saving review with period info:', {
          quarter,
          periodType,
          transitionId,
          periodStartDate,
          periodEndDate,
          totalRatingsCount: Object.keys(allQuarterRatings).length,
          filteredRatingsCount: Object.keys(currentRatings).length,
          kpiIdsCount: kpiIds.size
        });

        // Create or update quarterly self review
        // Always set status to 'in_progress' when saving (Save/Next buttons)
        // Only the Submit button should set status to 'submitted'
        const result = await evaluationService.selfReviews.upsert({
          employee_id: employeeId,
          cycle_id: cycleId,
          quarter,
          overall_rating: overallRating,
          overall_comments: overallComments,
          status: 'in_progress',
          period_type: periodType || undefined,
          transition_id: transitionId || undefined,
          period_start_date: periodStartDate || undefined,
          period_end_date: periodEndDate || undefined,
        });

        console.log('Review save result:', result.data);

        if (result.data) {
          review = result.data;
          // Update the review in state - for transitions, this ensures we have the correct period-specific review
          setQuarterlyReviews(prev => ({ ...prev, [quarter]: review }));

          // Save all goal self ratings in one bulk request (only for KPIs in current period)
          const ratingsToSave = Object.values(currentRatings).map(rating => ({
            goal_id: rating.goal_id,
            achievement: rating.achievement,
            self_rating: rating.self_rating,
            achieved_value: rating.achieved_value,
            target_value: rating.target_value,
            evidence: rating.evidence,
          }));

          if (ratingsToSave.length > 0 && review.id) {
            const bulkResult = await evaluationService.goalSelfRatings.bulkUpsert(review.id, ratingsToSave);
            console.log('Ratings saved successfully:', bulkResult);
            
            // After saving ratings, fetch the updated ratings to update the UI
            try {
              const ratingsResult = await evaluationService.goalSelfRatings.get(review.id);
              if (ratingsResult.data && ratingsResult.data.length > 0) {
                // Convert the fetched ratings to the KpiRating format
                const fetchedRatings: Record<string, KpiRating> = {};
                ratingsResult.data.forEach((r: any) => {
                  fetchedRatings[r.goal_id] = {
                    goal_id: r.goal_id,
                    achievement: r.achievement || '',
                    self_rating: r.self_rating || null,
                    achieved_value: r.achieved_value,
                    target_value: r.target_value,
                    evidence: r.evidence || '',
                  };
                });
                
                // Update the ratings for this quarter
                if (onRatingsUpdate) {
                  onRatingsUpdate(quarter, fetchedRatings);
                }
                console.log('Updated ratings after save:', fetchedRatings);
              }
            } catch (error) {
              console.error('Error fetching updated ratings:', error);
              // Don't fail the save if this fetch fails
            }
            
            // After saving ratings, fetch the updated review to ensure we have the latest data
            // This is especially important for transitions where we need the period-specific review
            if (periodType && transitionId) {
              try {
                const updatedReviewResult = await evaluationService.selfReviews.getByQuarter(
                  employeeId,
                  cycleId,
                  quarter,
                  periodType,
                  transitionId
                );
                if (updatedReviewResult.data) {
                  console.log('Fetched updated review:', updatedReviewResult.data);
                  setQuarterlyReviews(prev => ({ ...prev, [quarter]: updatedReviewResult.data }));
                }
              } catch (error) {
                console.error('Error fetching updated review:', error);
                // Don't fail the save if this fetch fails
              }
            }
          }
        }

        toasts.success('Progress saved');
        onSuccess();
      } catch (error) {
        console.error('Error saving review:', error);
        toasts.error(error);
      } finally {
        setSaving(false);
      }
    },
    [employeeId, cycleId, quarterlyReviews, kpiRatings, kpis, periodType, transitionId, periodStartDate, periodEndDate, onSuccess, onRatingsUpdate]
  );

  const submitEvaluation = useCallback(
    async (
      quarter: number,
      overallComments: string,
      overallRating: number | undefined,
      setQuarterlyReviews: (fn: (prev: Record<number, QuarterlySelfReviewData | null>) => Record<number, QuarterlySelfReviewData | null>) => void
    ) => {
      if (!employeeId || !cycleId) return;
      
      const allQuarterRatings = kpiRatings[quarter] || {};
      // Filter ratings to only include ratings for KPIs in the current period
      const kpiIds = new Set(kpis.map(k => k.id));
      const currentRatings: Record<string, KpiRating> = {};
      Object.keys(allQuarterRatings).forEach(goalId => {
        if (kpiIds.has(goalId)) {
          currentRatings[goalId] = allQuarterRatings[goalId];
        }
      });
      const missingRatings = kpis.filter(g => !currentRatings[g.id]?.self_rating);

      if (missingRatings.length > 0) {
        toasts.error('Incomplete ratings', 'Please rate all your KPIs before submitting');
        return;
      }

      setSaving(true);
      try {
        await saveProgress(quarter, overallComments, overallRating, setQuarterlyReviews);

        const result = await evaluationService.selfReviews.upsert({
          employee_id: employeeId,
          cycle_id: cycleId,
          quarter,
          overall_rating: overallRating,
          overall_comments: overallComments,
          status: 'submitted',
          period_type: periodType || undefined,
          transition_id: transitionId || undefined,
          period_start_date: periodStartDate || undefined,
          period_end_date: periodEndDate || undefined,
        });

        // Update local state with submitted review immediately
        if (result.data) {
          setQuarterlyReviews(prev => ({ ...prev, [quarter]: result.data }));
        }

        toasts.success(`Q${quarter} Self review submitted`);
        onSuccess();
      } catch (error) {
        toasts.error(error);
      } finally {
        setSaving(false);
      }
    },
    [employeeId, cycleId, kpiRatings, kpis, saveProgress, periodType, transitionId, periodStartDate, periodEndDate, onSuccess]
  );

  return {
    saving,
    saveProgress,
    submitEvaluation,
  };
}
