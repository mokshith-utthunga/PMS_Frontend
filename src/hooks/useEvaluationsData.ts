
import { useState, useEffect, useCallback, useMemo } from 'react';
import { goalsService, evaluationService, settingsService } from '@/services';
import { logError } from '@/errors';
import { parseNumericTarget } from '@/components/evaluation/AchievementSlider';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { useCurrentEmployee } from './useCurrentEmployee';
import { useTransition } from './useTransition';
import type { KRA, Goal, PerformanceCycle, RatingScale } from '@/types';
import type { QuarterlySelfReviewData, GoalSelfRatingData } from '@/services/evaluation.service';
import type { QuarterlyCycle } from '@/services/cycle.service';
import type { PeriodType } from '@/services/transition.service';

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
  quarterlyCycles: QuarterlyCycle[];
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
  // Get active cycle data from context (fetched once at app initialization)
  const { activeCycle: activeCycleFromContext, quarterlyCycles: quarterlyCyclesFromContext } = useActiveCycle();
  // Get current employee from cached hook (fetched once at app initialization)
  const { employee: currentEmployee } = useCurrentEmployee();
  
  const [data, setData] = useState<EvaluationsData>({
    employeeId: currentEmployee?.id || null,
    activeCycle: activeCycleFromContext,
    quarterlyCycles: (quarterlyCyclesFromContext || []) as QuarterlyCycle[],
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

  // Update activeCycle, quarterlyCycles, and employee when context data changes
  useEffect(() => {
    if (activeCycleFromContext || quarterlyCyclesFromContext) {
      setData(prev => ({
        ...prev,
        activeCycle: activeCycleFromContext || prev.activeCycle,
        quarterlyCycles: (quarterlyCyclesFromContext || []) as QuarterlyCycle[],
      }));
    }
    if (currentEmployee) {
      setData(prev => ({ ...prev, employeeId: currentEmployee.id }));
    }
  }, [activeCycleFromContext, quarterlyCyclesFromContext, currentEmployee]);

  const fetchData = useCallback(async () => {
    if (!userId || !currentEmployee) return;

    try {
      const employeeId = currentEmployee.id;

      // Use active cycle from context (already fetched at app initialization)
      const activeCycle = activeCycleFromContext;
      if (!activeCycle) {
        setData(prev => ({ ...prev, employeeId, loading: false }));
        return;
      }

      const cycleId = activeCycle.id;
      const quarterlyCycles = (quarterlyCyclesFromContext || []) as QuarterlyCycle[];

      // Fetch base data in parallel - get scales, self reviews, and quarter-specific goals
      // Note: For backward compatibility, we fetch all reviews (including period-specific ones)
      const [scalesResult, selfReviewsResult] = await Promise.all([
        settingsService.ratingScales.getDefault(),
        evaluationService.selfReviews.get(employeeId, cycleId),
      ]);

      const ratingScales = (scalesResult.data || []).sort((a, b) => b.value - a.value);

      // Fetch goals for all 4 quarters in parallel
      // Note: Pre-transition goals have status='locked', so we fetch without status filter
      // to include both 'approved' and 'locked' statuses
      const quarterPromises = [1, 2, 3, 4].map(async (q) => {
        const [krasResult, kpisResult] = await Promise.all([
          goalsService.kras.getByEmployee(employeeId, cycleId, undefined, q), // No status filter - include both 'approved' and 'locked'
          goalsService.kpis.getByEmployee(employeeId, cycleId, undefined, q), // No status filter - include both 'approved' and 'locked'
        ]);
        // Filter to only include KRAs/KPIs with status='approved' or 'locked'
        const filteredKras = (krasResult.data || []).filter((kra: KRA) => 
          kra.status === 'approved' || kra.status === 'locked'
        );
        const filteredKpis = (kpisResult.data || []).filter((g: Goal) => 
          g.kra_id && (g.status === 'approved' || g.status === 'locked')
        ) as Goal[];
        return {
          quarter: q,
          kras: filteredKras,
          kpis: filteredKpis,
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

      // Process quarterly self reviews - handle multiple reviews per quarter (pre-transition, post-transition)
      // Store all reviews, but for backward compatibility, also store the "primary" review per quarter
      // Primary review priority: post_transition > pre_transition > full_quarter
      const reviewsMap: Record<number, QuarterlySelfReviewData | null> = {
        1: null, 2: null, 3: null, 4: null
      };
      const allReviewsByQuarter: Record<number, QuarterlySelfReviewData[]> = {
        1: [], 2: [], 3: [], 4: []
      };
      
      (selfReviewsResult.data || []).forEach((review: QuarterlySelfReviewData) => {
        if (review.quarter) {
          const q = review.quarter;
          allReviewsByQuarter[q].push(review);
          
          // Determine primary review: prefer post_transition, then pre_transition, then full_quarter
          const currentPrimary = reviewsMap[q];
          if (!currentPrimary) {
            reviewsMap[q] = review;
          } else {
            const currentPriority = currentPrimary.period_type === 'post_transition' ? 3 
              : currentPrimary.period_type === 'pre_transition' ? 2 
              : 1;
            const newPriority = review.period_type === 'post_transition' ? 3 
              : review.period_type === 'pre_transition' ? 2 
              : 1;
            if (newPriority > currentPriority) {
              reviewsMap[q] = review;
            }
          }
        }
      });

      // Fetch goal self ratings for all quarterly reviews
      // For transitions, we need to merge ratings from both pre and post-transition reviews
      const ratingsMap: Record<number, Record<string, KpiRating>> = {};
      
      for (const [quarter, reviews] of Object.entries(allReviewsByQuarter)) {
        const q = parseInt(quarter);
        const quarterRatings: Record<string, KpiRating> = {};
        const qKpis = quarterKpis[q] || [];

        // Fetch ratings from all reviews for this quarter (pre-transition, post-transition, full_quarter)
        for (const review of reviews) {
          if (review?.id) {
            const ratingsResult = await evaluationService.goalSelfRatings.get(review.id);
            
            (ratingsResult.data || []).forEach((r: GoalSelfRatingData) => {
              // Only add rating if it matches the KPI's period_type and transition_id
              const kpi = qKpis.find((k: Goal) => k.id === r.goal_id);
              if (kpi) {
                const kpiPeriodType = kpi.period_type || 'full_quarter';
                const kpiTransitionId = kpi.transition_id || null;
                const reviewPeriodType = review.period_type || 'full_quarter';
                const reviewTransitionId = review.transition_id || null;
                
                // Match rating to KPI if period_type and transition_id match
                if (kpiPeriodType === reviewPeriodType && 
                    (kpiTransitionId === reviewTransitionId || (!kpiTransitionId && !reviewTransitionId))) {
                  quarterRatings[r.goal_id] = {
                    goal_id: r.goal_id,
                    achievement: r.achievement || '',
                    self_rating: r.self_rating || null,
                    achieved_value: r.achieved_value,
                    target_value: r.target_value,
                    evidence: r.evidence || '',
                  };
                }
              }
            });
          }
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
        activeCycle: activeCycle,
        quarterlyCycles,
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
  }, [userId, selectedQuarter, activeCycleFromContext, quarterlyCyclesFromContext, currentEmployee]);

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
