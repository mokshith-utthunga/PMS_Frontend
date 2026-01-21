
import { useState, useEffect, useCallback, useMemo } from 'react';
import { employeeService, cycleService, goalsService, evaluationService, settingsService } from '@/services';
import { logError } from '@/errors';
import { parseNumericTarget } from '@/components/evaluation/AchievementSlider';
import type { KRA, Goal, PerformanceCycle, RatingScale } from '@/types';
import type { QuarterlySelfReviewData, GoalSelfRatingData } from '@/services/evaluation.service';

export interface KpiRating {
  goal_id: string;
  achievement?: string;
  self_rating: number | null;
  achieved_value?: number | null;
  target_value?: number | null;
  evidence?: string;
}

// Export GoalRating as an alias for KpiRating for backward compatibility
export type GoalRating = KpiRating;

export interface EvaluationsData {
  employeeId: string | null;
  activeCycle: PerformanceCycle | null;
  kras: KRA[];
  kpis: Goal[];
  ratingScales: RatingScale[];
  quarterlyReviews: Record<number, QuarterlySelfReviewData | null>;
  kpiRatings: Record<number, Record<string, KpiRating>>;
  loading: boolean;
  // Quarter-specific data
  quarterKras: Record<number, KRA[]>;
  quarterKpis: Record<number, Goal[]>;
  // Late permission status per quarter
  latePermissions: Record<number, boolean>;
}

export function useEvaluationsData(userId: string | undefined, selectedQuarter?: number | null) {
  const [data, setData] = useState<EvaluationsData>({
    employeeId: null,
    activeCycle: null,
    kras: [],
    kpis: [],
    ratingScales: [],
    quarterlyReviews: {},
    kpiRatings: {},
    loading: true,
    quarterKras: {},
    quarterKpis: {},
    latePermissions: {},
  });

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      // Get employee
      const empResult = await employeeService.getMe();
      if (!empResult.data) {
        setData(prev => ({ ...prev, loading: false }));
        return;
      }

      const employeeId = empResult.data.id;

      // Get active cycle
      const cycleResult = await cycleService.getActive();
      if (!cycleResult.data) {
        setData(prev => ({ ...prev, employeeId, loading: false }));
        return;
      }

      const cycleId = cycleResult.data.id;

      // Fetch base data in parallel - get scales, self reviews, and quarter-specific goals
      const [scalesResult, selfReviewsResult] = await Promise.all([
        settingsService.ratingScales.getDefault(),
        evaluationService.selfReviews.get(employeeId, cycleId),
      ]);

      const ratingScales = (scalesResult.data || []).sort((a, b) => b.value - a.value);

      // Fetch goals for all 4 quarters in parallel
      const quarterPromises = [1, 2, 3, 4].map(async (q) => {
        const [krasResult, kpisResult] = await Promise.all([
          goalsService.kras.getByEmployee(employeeId, cycleId, 'approved', q),
          goalsService.kpis.getByEmployee(employeeId, cycleId, 'approved', q),
        ]);
        return {
          quarter: q,
          kras: krasResult.data || [],
          kpis: (kpisResult.data || []).filter((g: Goal) => g.kra_id) as Goal[],
        };
      });

      const quarterResults = await Promise.all(quarterPromises);

      // Build quarter-specific maps
      const quarterKras: Record<number, KRA[]> = {};
      const quarterKpis: Record<number, Goal[]> = {};
      let allKras: KRA[] = [];
      let allKpis: Goal[] = [];

      quarterResults.forEach(({ quarter, kras, kpis }) => {
        quarterKras[quarter] = kras;
        quarterKpis[quarter] = kpis;
        allKras = [...allKras, ...kras];
        allKpis = [...allKpis, ...kpis];
      });

      // Process quarterly self reviews
      const reviewsMap: Record<number, QuarterlySelfReviewData | null> = {
        1: null, 2: null, 3: null, 4: null
      };
      (selfReviewsResult.data || []).forEach((review: QuarterlySelfReviewData) => {
        if (review.quarter) {
          reviewsMap[review.quarter] = review;
        }
      });

      // Fetch goal self ratings for all quarterly reviews
      const ratingsMap: Record<number, Record<string, KpiRating>> = {};
      
      for (const [quarter, review] of Object.entries(reviewsMap)) {
        const q = parseInt(quarter);
        const quarterRatings: Record<string, KpiRating> = {};
        const qKpis = quarterKpis[q] || [];

        if (review?.id) {
          const ratingsResult = await evaluationService.goalSelfRatings.get(review.id);
          
          (ratingsResult.data || []).forEach((r: GoalSelfRatingData) => {
            quarterRatings[r.goal_id] = {
              goal_id: r.goal_id,
              achievement: r.achievement || '',
              self_rating: r.self_rating || null,
              achieved_value: r.achieved_value,
              target_value: r.target_value,
              evidence: r.evidence || '',
            };
          });
        }

        // Initialize missing goals for this quarter
        qKpis.forEach((g: Goal) => {
          if (!quarterRatings[g.id]) {
            const numericTarget = parseNumericTarget(g.target_value);
            quarterRatings[g.id] = {
              goal_id: g.id,
              achievement: '',
              self_rating: null,
              achieved_value: null,
              target_value: numericTarget,
              evidence: '',
            };
          }
        });

        ratingsMap[q] = quarterRatings;
      }

      // Fetch late permissions for all quarters
      const latePermissions: Record<number, boolean> = { 1: false, 2: false, 3: false, 4: false };
      const latePermPromises = [1, 2, 3, 4].map(async (q) => {
        try {
          const result = await goalsService.lateSubmission.check(cycleId, q);
          return { quarter: q, hasPermission: result.hasPermission ?? false };
        } catch {
          return { quarter: q, hasPermission: false };
        }
      });

      const latePermResults = await Promise.all(latePermPromises);
      latePermResults.forEach(({ quarter, hasPermission }) => {
        latePermissions[quarter] = hasPermission;
      });

      setData({
        employeeId,
        activeCycle: cycleResult.data,
        kras: allKras,
        kpis: allKpis,
        ratingScales,
        quarterlyReviews: reviewsMap,
        kpiRatings: ratingsMap,
        loading: false,
        quarterKras,
        quarterKpis,
        latePermissions,
      });
    } catch (error) {
      logError(error, 'useEvaluationsData');
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get current quarter
  const currentQuarter = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    if (month < 3) return 1;
    if (month < 6) return 2;
    if (month < 9) return 3;
    return 4;
  }, []);

  // Get goals for the selected quarter
  const selectedQuarterKras = useMemo(() => {
    if (!selectedQuarter) return data.kras;
    return data.quarterKras[selectedQuarter] || [];
  }, [selectedQuarter, data.quarterKras, data.kras]);

  const selectedQuarterKpis = useMemo(() => {
    if (!selectedQuarter) return data.kpis;
    return data.quarterKpis[selectedQuarter] || [];
  }, [selectedQuarter, data.quarterKpis, data.kpis]);

  return { 
    ...data, 
    currentQuarter, 
    refetch: fetchData,
    selectedQuarterKras,
    selectedQuarterKpis,
  };
}
