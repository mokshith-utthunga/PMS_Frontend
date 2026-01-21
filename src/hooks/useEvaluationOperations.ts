// Custom hook for evaluation save/submit operations
// Uses quarterly_self_reviews and goal_self_ratings tables
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
}

export function useEvaluationOperations({
  employeeId,
  cycleId,
  quarterlyReviews,
  kpiRatings,
  kpis,
  onSuccess,
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
        const currentRatings = kpiRatings[quarter] || {};

        // Create or update quarterly self review
        const result = await evaluationService.selfReviews.upsert({
          employee_id: employeeId,
          cycle_id: cycleId,
          quarter,
          overall_rating: overallRating,
          overall_comments: overallComments,
          status: review?.status === 'submitted' ? 'submitted' : 'in_progress',
        });

        if (result.data) {
          review = result.data;
          setQuarterlyReviews(prev => ({ ...prev, [quarter]: review }));

          // Save all goal self ratings in one bulk request
          const ratingsToSave = Object.values(currentRatings).map(rating => ({
            goal_id: rating.goal_id,
            achievement: rating.achievement,
            self_rating: rating.self_rating,
            achieved_value: rating.achieved_value,
            target_value: rating.target_value,
            evidence: rating.evidence,
          }));

          if (ratingsToSave.length > 0 && review.id) {
            await evaluationService.goalSelfRatings.bulkUpsert(review.id, ratingsToSave);
          }
        }

        toasts.success('Progress saved');
        onSuccess();
      } catch (error) {
        toasts.error(error);
      } finally {
        setSaving(false);
      }
    },
    [employeeId, cycleId, quarterlyReviews, kpiRatings, onSuccess]
  );

  const submitEvaluation = useCallback(
    async (
      quarter: number,
      overallComments: string,
      overallRating: number | undefined,
      setQuarterlyReviews: (fn: (prev: Record<number, QuarterlySelfReviewData | null>) => Record<number, QuarterlySelfReviewData | null>) => void
    ) => {
      if (!employeeId || !cycleId) return;
      
      const currentRatings = kpiRatings[quarter] || {};
      const missingRatings = kpis.filter(g => !currentRatings[g.id]?.self_rating);

      if (missingRatings.length > 0) {
        toasts.error('Incomplete ratings', 'Please rate all your KPIs before submitting');
        return;
      }

      setSaving(true);
      try {
        // Save first
        await saveProgress(quarter, overallComments, overallRating, setQuarterlyReviews);

        // Then submit
        await evaluationService.selfReviews.upsert({
          employee_id: employeeId,
          cycle_id: cycleId,
          quarter,
          overall_rating: overallRating,
          overall_comments: overallComments,
          status: 'submitted',
        });

        toasts.success(`Q${quarter} Self review submitted`);
        onSuccess();
      } catch (error) {
        toasts.error(error);
      } finally {
        setSaving(false);
      }
    },
    [employeeId, cycleId, kpiRatings, kpis, saveProgress, onSuccess]
  );

  return {
    saving,
    saveProgress,
    submitEvaluation,
  };
}
