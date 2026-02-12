// Evaluations Page - Quarterly Self Evaluation
// Uses quarterly_self_reviews and quarterly_kpi_progress tables
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Send, Target, AlertCircle, ChevronRight, Calendar, AlertTriangle, ArrowRight, Lock } from 'lucide-react';
import { PageLoader } from '@/loaders';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { useEvaluationsData, useEvaluationOperations, useTransition, type KpiRating } from '@/hooks';
import { evaluationService, transitionService } from '@/services';
import { getPeriodLabel, getPeriodBadgeVariant, formatPeriodDateRange } from '@/utils/periodHelpers';
import { useQuarterFromUrl } from '@/hooks/useQuarterFromUrl';
import { isQuarterOpen, getQuarterTiming, formatQuarterDates } from '@/utils/quarterUtils';
import { 
  hasQuarterStarted, 
  hasQuarterEnded, 
  canWorkOnQuarter,
  formatDateShort,
  getQuarterEndDateFromCycle,
  type CycleWithQuarterDates
} from '@/utils/quarterHelpers';
import { calculateAllKRARatings, calculateQuarterRating, type KPIForCalculation } from '@/lib/ratingCalculations';
import { calculateRatingFromCalibration } from '@/components/evaluation/CalibrationDisplay';
import type { Goal } from '@/types';
import { QuarterTabs } from '@/components/evaluation/QuarterTabs';
import { QuarterAlerts } from '@/components/evaluation/QuarterAlerts';
import { KRAEvaluationCard } from '@/components/evaluation/KRAEvaluationCard';
import { OverallAssessmentTab } from '@/components/evaluation/OverallAssessmentTab';
import PeriodClose from '@/components/evaluation/PeriodClose';

export default function Evaluations() {
  const { user, hasAnyRole } = useAuth();
  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin']);
  const { selfReview } = useActiveCycle();
  const { employee: currentEmployee } = useCurrentEmployee();

  // URL-based quarter handling
  const { quarter, setQuarter, isValidQuarter } = useQuarterFromUrl();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local state for form data - sync with URL quarter
  // Initialize with URL quarter if available, otherwise default to '1'
  const [selectedQuarter, setSelectedQuarter] = useState<string>(() => {
    if (quarter) return String(quarter);
    return '1';
  });
  
  // Track nested tab within quarter: 'pre-transition' or 'transition'
  // Default to 'pre-transition', will be updated based on transition and quarter
  const [nestedTab, setNestedTab] = useState<'pre-transition' | 'transition'>('pre-transition');
  // isTransitionTab is true when nestedTab is 'transition'
  const isTransitionTab = nestedTab === 'transition';

  // Fetch evaluations data with selected quarter
  // Use URL quarter if available, otherwise use selectedQuarter
  // Note: useEvaluationsData fetches all quarters, but we pass selectedQuarter for context
  const quarterForFetch = quarter || parseInt(selectedQuarter) || 1;
  const evalData = useEvaluationsData(user?.id, quarterForFetch);
  const {
    employeeId, activeCycle, quarterlyCycles, ratingScales,
    quarterlyReviews: initialQuarterlyReviews,
    allReviewsByQuarter,
    kpiRatings: initialKpiRatings,
    currentQuarter, loading, refetch,
    quarterKras, quarterKpis,
    latePermissions,
  } = evalData;
  
  // Fetch transition data for the selected quarter
  // Use URL quarter if available, otherwise use selectedQuarter
  const quarterForTransition = quarter || parseInt(selectedQuarter) || null;
  const { transition, loading: transitionLoading } = useTransition({
    employeeId: employeeId || undefined,
    cycleId: activeCycle?.id,
    quarter: quarterForTransition,
    enabled: !!employeeId && !!activeCycle && !!quarterForTransition,
  });
  
  // Fetch transitions for all quarters to know which quarters have transitions
  const [transitions, setTransitions] = useState<Record<number, any>>({});
  useEffect(() => {
    if (employeeId && activeCycle?.id) {
      transitionService.getByEmployee(employeeId, activeCycle.id)
        .then(result => {
          const transitionsMap: Record<number, any> = {};
          const transitionsArray = Array.isArray(result) ? result : [];
          transitionsArray.forEach((t: any) => {
            transitionsMap[t.quarter] = t;
          });
          setTransitions(transitionsMap);
        })
        .catch(error => {
          console.error('Error fetching transitions:', error);
        });
    }
  }, [employeeId, activeCycle?.id]);
  
  // Sync nested tab with URL transition parameter
  useEffect(() => {
    const isTransitionFromUrl = searchParams.get('transition') === 'true';
    if (isTransitionFromUrl) {
      setNestedTab('transition');
    } else {
      setNestedTab('pre-transition');
    }
  }, [searchParams]);
  
  // Sync selectedQuarter with URL quarter - prioritize URL over currentQuarter
  // URL is the single source of truth for quarter selection
  useEffect(() => {
    if (quarter) {
      // URL has quarter, use it - this is the source of truth
      console.log('[Evaluations] Syncing selectedQuarter from URL quarter:', quarter);
      setSelectedQuarter(String(quarter));
    } else if (currentQuarter && !isValidQuarter) {
      // No URL quarter but we have currentQuarter and URL is invalid, use currentQuarter
      console.log('[Evaluations] No URL quarter, using currentQuarter:', currentQuarter);
      setSelectedQuarter(String(currentQuarter));
      setQuarter(currentQuarter as 1 | 2 | 3 | 4);
    }
  }, [quarter, currentQuarter, setQuarter, isValidQuarter]);
  const [quarterlyReviews, setQuarterlyReviews] = useState(initialQuarterlyReviews);
  const [kpiRatings, setKpiRatings] = useState(initialKpiRatings);
  // Store overall comments by quarter and period type (pre-transition/post-transition)
  // Format: { [quarter]: { pre_transition: string, post_transition: string } }
  const [overallComments, setOverallComments] = useState<Record<number, { pre_transition?: string; post_transition?: string }>>({});
  const [evaluationTab, setEvaluationTab] = useState<Record<number, string>>({});
  
  // KRA/KPI rejection state - track rejections per quarter
  const [kraKpiRejections, setKraKpiRejections] = useState<Record<number, Record<string, any>>>({});

  // Update quarterly reviews when they change
  useEffect(() => {
    setQuarterlyReviews(initialQuarterlyReviews);
  }, [initialQuarterlyReviews]);

  // Use initialKpiRatings directly from useEvaluationsData
  // File uploads update local state via onFilesChange, no refetch needed
  useEffect(() => {
    setKpiRatings(initialKpiRatings);
  }, [initialKpiRatings]);

  // Only auto-select quarter if URL doesn't have a valid quarter
  // This should only run once on initial load, not when URL changes
  useEffect(() => {
    // If URL already has a valid quarter, don't override it
    if (isValidQuarter && quarter) {
      return;
    }
    
    // Only auto-select if we don't have a valid quarter in URL
    if (activeCycle && !isValidQuarter && !quarter) {
      // Use backend response to determine default quarter
      if (selfReview?.enabled && selfReview?.review_for_quarter) {
        // If self review is enabled, select the review_for_quarter
        setSelectedQuarter(String(selfReview.review_for_quarter));
        setQuarter(selfReview.review_for_quarter as 1 | 2 | 3 | 4);
        // Reset nested tab to pre-transition
        setNestedTab('pre-transition');
        return;
      }
      
      // Fallback to date-based calculation if backend data not available
      for (let q = 1; q <= 4; q++) {
        // Only select quarters that are current or past (not future)
        const timing = getQuarterTiming(activeCycle, q, quarterlyCycles);
        if (timing !== 'future' && isQuarterOpen(activeCycle, q, quarterlyCycles)) {
          setSelectedQuarter(String(q));
          setQuarter(q as 1 | 2 | 3 | 4);
          return;
        }
      }
      if (currentQuarter) {
        const timing = getQuarterTiming(activeCycle, currentQuarter, quarterlyCycles);
        if (timing !== 'future') {
          setSelectedQuarter(String(currentQuarter));
          setQuarter(currentQuarter as 1 | 2 | 3 | 4);
        } else {
          // Find the latest non-future quarter
          for (let q = 4; q >= 1; q--) {
            const t = getQuarterTiming(activeCycle, q, quarterlyCycles);
            if (t !== 'future') {
              setSelectedQuarter(String(q));
              setQuarter(q as 1 | 2 | 3 | 4);
              return;
            }
          }
        }
      }
    }
  }, [activeCycle, currentQuarter, isValidQuarter, quarter, setQuarter, quarterlyCycles, selfReview]);

  useEffect(() => {
    const q = parseInt(selectedQuarter);
    if (q >= 1 && q <= 4) {
      // Only update URL if selectedQuarter differs from URL quarter
      // This prevents circular updates and ensures URL is the source of truth
      // Don't update URL if it's already correct - this prevents overriding URL quarter
      if (quarter !== q) {
        console.log('[Evaluations] Updating URL quarter from selectedQuarter:', q, 'current URL quarter:', quarter);
        setQuarter(q as 1 | 2 | 3 | 4);
      }
    }

    // Load comments from the correct period-specific review
    const qTransition = transitions[q] || (transition && transition.quarter === q ? transition : null);
    const periodType = isTransitionTab ? 'post_transition' : 'pre_transition';
    
    if (qTransition) {
      // For transition employees, find the period-specific review
      const allReviews = allReviewsByQuarter[q] || [];
      const matchingReview = allReviews.find((r: any) => 
        r.period_type === periodType && 
        String(r.transition_id) === String(qTransition.id)
      );
      
      if (matchingReview) {
        setOverallComments(prev => ({
          ...prev,
          [q]: {
            ...prev[q],
            [periodType]: matchingReview.overall_comments || ''
          }
        }));
      } else {
        setOverallComments(prev => ({
          ...prev,
          [q]: {
            ...prev[q],
            [periodType]: ''
          }
        }));
      }
    } else {
      // For non-transition employees, use the primary review
      const review = quarterlyReviews[q];
      if (review) {
        setOverallComments(prev => ({
          ...prev,
          [q]: {
            ...prev[q],
            pre_transition: review.overall_comments || ''
          }
        }));
      } else {
        setOverallComments(prev => ({
          ...prev,
          [q]: {
            ...prev[q],
            pre_transition: ''
          }
        }));
      }
    }

    setEvaluationTab(prev => {
      if (!prev[q]) {
        return { ...prev, [q]: 'goals' };
      }
      return prev;
    });
  }, [selectedQuarter, quarterlyReviews, setQuarter, quarter, transitions, transition, isTransitionTab, allReviewsByQuarter]);

  // Use URL quarter if available, otherwise use selectedQuarter
  const activeQuarter = quarter || parseInt(selectedQuarter) || 1;
  
  // Fetch KRA/KPI rejections for the active quarter
  useEffect(() => {
    const fetchRejections = async () => {
      if (!employeeId || !activeCycle?.id || !activeQuarter) return;
      
      try {
        // Fetch rejections by employee_id, cycle_id, and quarter
        // This will get all rejections for the quarter regardless of manager_review_id
        // This handles transitions where there might be multiple manager reviews
        const rejectionsResult = await evaluationService.kraKpiRejections.get({
          employee_id: employeeId,
          cycle_id: activeCycle.id,
          quarter: activeQuarter,
        });
        
        // Create a map of rejections by KRA/KPI ID for this quarter
        const rejectionsMap: Record<string, any> = {};
        (rejectionsResult.data || []).forEach((rejection: any) => {
          const key = rejection.kra_id || rejection.goal_id;
          if (key) {
            // If multiple rejections exist for same KPI (shouldn't happen, but handle it)
            // Keep the most recent one
            if (!rejectionsMap[key] || new Date(rejection.rejected_at) > new Date(rejectionsMap[key].rejected_at)) {
              rejectionsMap[key] = rejection;
            }
          }
        });
        
        console.log('[Evaluations] Fetched rejections for Q' + activeQuarter + ':', {
          totalRejections: rejectionsResult.data?.length || 0,
          rejectionsMap,
          rejectionKeys: Object.keys(rejectionsMap),
        });
        
        setKraKpiRejections(prev => ({
          ...prev,
          [activeQuarter]: rejectionsMap,
        }));
      } catch (error) {
        console.error('Error fetching KRA/KPI rejections:', error);
      }
    };
    
    fetchRejections();
  }, [employeeId, activeCycle?.id, activeQuarter]);

  // Debug logging
  useEffect(() => {
    console.log('[Evaluations] Quarter state:', {
      urlQuarter: quarter,
      selectedQuarter,
      activeQuarter,
      isValidQuarter,
      currentQuarter,
    });
  }, [quarter, selectedQuarter, activeQuarter, isValidQuarter, currentQuarter]);
  
  const currentQuarterKpis = useMemo(() => {
    return quarterKpis[activeQuarter] || [];
  }, [quarterKpis, activeQuarter]);

  // Calculate which KPIs are relevant for the current period (for saving)
  const currentPeriodKpis = useMemo(() => {
    const q = activeQuarter;
    const qKpis = quarterKpis[q] || [];
    // Use transitions state (which has all quarters) instead of transition hook (which only has active quarter)
    const qTransition = transitions[q] || (transition && transition.quarter === q ? transition : null);
    
    if (!qTransition) {
      // No transition: return all KPIs (full quarter, null transition_id, etc.)
      return qKpis.filter(k => !k.period_type || k.period_type === 'full_quarter' || !k.transition_id);
    }
    
    // Has transition: filter based on active tab
    const transitionIdStr = String(qTransition.id);
    if (isTransitionTab) {
      // Transition tab: return post-transition KPIs with matching transition_id
      return qKpis.filter(k => k.period_type === 'post_transition' && k.transition_id && String(k.transition_id) === transitionIdStr);
    } else {
      // Pre-transition tab: return pre-transition KPIs with matching transition_id,
      // OR KPIs with null transition_id, OR KPIs with full_quarter period_type
      return qKpis.filter(k => {
        if (!k.transition_id) {
          // KPIs with null transition_id should be included in pre-transition tab
          return true;
        }
        if (k.period_type === 'full_quarter') {
          // KPIs with full_quarter period_type should be included in pre-transition tab
          return true;
        }
        return k.period_type === 'pre_transition' && String(k.transition_id) === transitionIdStr;
      });
    }
  }, [activeQuarter, quarterKpis, transitions, transition, isTransitionTab]);

  // Determine period info for the current quarter based on transition and KPIs being rated
  // This determines which period-specific review to save to
  const currentQuarterPeriodInfo = useMemo(() => {
    const q = activeQuarter;
    // Use transitions state (which has all quarters) instead of transition hook (which only has active quarter)
    const qTransition = transitions[q] || (transition && transition.quarter === q ? transition : null);
    
    if (!qTransition) {
      return { periodType: null, transitionId: null, periodStartDate: null, periodEndDate: null };
    }
    
    // Calculate period dates if not provided in transition object
    // Get quarter dates from quarterlyCycles
    const quarterlyCycle = quarterlyCycles?.find(qc => qc.quarter === q);
    const quarterStart = quarterlyCycle?.quarter_start_date ? new Date(quarterlyCycle.quarter_start_date) : null;
    const quarterEnd = quarterlyCycle?.quarter_end_date ? new Date(quarterlyCycle.quarter_end_date) : null;
    
    // Determine current date vs transition date
    const transitionDate = new Date(qTransition.transition_date);
    transitionDate.setHours(0, 0, 0, 0);
    
    // Calculate post-transition period dates if not provided
    const calculatedPostStartDate = qTransition.post_period_start_date 
      ? qTransition.post_period_start_date 
      : (transitionDate && quarterEnd ? transitionDate.toISOString().split('T')[0] : null);
    const calculatedPostEndDate = qTransition.post_period_end_date 
      ? qTransition.post_period_end_date 
      : (quarterEnd ? quarterEnd.toISOString().split('T')[0] : null);
    
    // Calculate pre-transition period dates if not provided
    const calculatedPreStartDate = qTransition.pre_period_start_date 
      ? qTransition.pre_period_start_date 
      : (quarterStart ? quarterStart.toISOString().split('T')[0] : null);
    // Pre-transition ends on the transition date itself (not transition date - 1)
    const calculatedPreEndDate = qTransition.pre_period_end_date 
      ? qTransition.pre_period_end_date 
      : (transitionDate ? transitionDate.toISOString().split('T')[0] : null);
    
    // Determine period info based on active tab
    // If we're in transition tab, always use post-transition
    // If we're in regular tab, always use pre-transition
    if (isTransitionTab) {
      // Transition tab: always post-transition
      return {
        periodType: 'post_transition' as const,
        transitionId: qTransition.id,
        periodStartDate: calculatedPostStartDate,
        periodEndDate: calculatedPostEndDate,
      };
    } else {
      // Regular tab: always pre-transition
      return {
        periodType: 'pre_transition' as const,
        transitionId: qTransition.id,
        periodStartDate: calculatedPreStartDate,
        periodEndDate: calculatedPreEndDate,
      };
    }
  }, [activeQuarter, transitions, transition, quarterlyCycles, isTransitionTab]);

  // Callback to update ratings after save
  // Simple merge: update with new data from backend, preserving existing local state
  // Evidence is updated via onFilesChange (file upload), so it's already in local state
  const handleRatingsUpdate = useCallback((quarter: number, newRatings: Record<string, any>) => {
    setKpiRatings(prev => {
      const quarterRatings = prev[quarter] || {};
      const updatedRatings = { ...quarterRatings };
      
      Object.keys(newRatings).forEach(goalId => {
        const existing: KpiRating = updatedRatings[goalId] || { 
          goal_id: goalId, 
          self_rating: null 
        };
        const newData: KpiRating = newRatings[goalId] || { 
          goal_id: goalId, 
          self_rating: null 
        };
        
        // Merge: use new data from backend, but preserve evidence from local state
        // (evidence is updated via file upload and may not be in backend response yet)
        updatedRatings[goalId] = {
          ...existing,
          ...newData,
          goal_id: goalId,
          // Preserve evidence from local state if newData doesn't have it or it's empty
          evidence: (newData.evidence && newData.evidence.trim()) 
            ? newData.evidence 
            : (existing.evidence || ''),
        };
      });
      
      return {
        ...prev,
        [quarter]: updatedRatings,
      };
    });
  }, []);

  const evalOps = useEvaluationOperations({
    employeeId,
    cycleId: activeCycle?.id || null,
    quarterlyReviews,
    kpiRatings,
    kpis: currentPeriodKpis,
    onSuccess: refetch,
    onRatingsUpdate: handleRatingsUpdate,
    periodType: currentQuarterPeriodInfo.periodType,
    transitionId: currentQuarterPeriodInfo.transitionId,
    periodStartDate: currentQuarterPeriodInfo.periodStartDate,
    periodEndDate: currentQuarterPeriodInfo.periodEndDate,
  });


  const handleKpiRatingChange = useCallback(
    (goalId: string, field: keyof KpiRating, value: unknown) => {
      const q = activeQuarter;
      setKpiRatings(prev => ({
        ...prev,
        [q]: {
          ...prev[q],
          [goalId]: {
            ...prev[q]?.[goalId],
            [field]: value,
          },
        },
      }));
    },
    [activeQuarter]
  );

  const calculateOverallRatingForQuarter = useCallback((quarterNum: number) => {
    const qKras = quarterKras[quarterNum] || [];
    const qKpis = quarterKpis[quarterNum] || [];
    const qKpiRatings = kpiRatings[quarterNum] || {};

    const qKpisWithKra: KPIForCalculation[] = qKpis
      .filter((kpi): kpi is Goal & { kra_id: string } => !!kpi.kra_id)
      .map(kpi => ({
        id: kpi.id,
        kra_id: kpi.kra_id,
        weight: kpi.weight,
      }));

    const qKpiRatingsForCalc: Record<string, number | null> = {};
    qKpis.forEach(kpi => {
      const achievedValue = qKpiRatings[kpi.id]?.achieved_value;
      if (kpi.calibration && kpi.calibration.length > 0 && achievedValue !== null && achievedValue !== undefined) {
        qKpiRatingsForCalc[kpi.id] = calculateRatingFromCalibration(achievedValue, kpi.calibration);
      } else {
        qKpiRatingsForCalc[kpi.id] = qKpiRatings[kpi.id]?.self_rating || null;
      }
    });

    const qKraRatings = calculateAllKRARatings(qKras, qKpisWithKra, qKpiRatingsForCalc);
    return calculateQuarterRating(qKras, qKraRatings);
  }, [quarterKras, quarterKpis, kpiRatings]);

  // Get the current period-specific comments
  const getCurrentPeriodComments = useCallback((quarterNum: number) => {
    const qTransition = transitions[quarterNum] || (transition && transition.quarter === quarterNum ? transition : null);
    const periodType = isTransitionTab ? 'post_transition' : 'pre_transition';
    
    if (qTransition) {
      return overallComments[quarterNum]?.[periodType] || '';
    } else {
      return overallComments[quarterNum]?.pre_transition || '';
    }
  }, [overallComments, transitions, transition, isTransitionTab]);

  const handleSave = useCallback(() => {
    const q = activeQuarter;
    const calculatedRating = calculateOverallRatingForQuarter(q);
    const currentComments = getCurrentPeriodComments(q);
    evalOps.saveProgress(q, currentComments, calculatedRating ?? undefined, setQuarterlyReviews);
  }, [activeQuarter, getCurrentPeriodComments, evalOps, calculateOverallRatingForQuarter]);

  const handleSubmit = useCallback(async () => {
    const q = activeQuarter;
    const calculatedRating = calculateOverallRatingForQuarter(q);
    const currentComments = getCurrentPeriodComments(q);
    await evalOps.submitEvaluation(q, currentComments, calculatedRating ?? undefined, setQuarterlyReviews);
    
    // After successful submission, refetch rejections to update hasActiveRejections
    // This ensures buttons are hidden if all rejections are now resubmitted
    if (employeeId && activeCycle?.id) {
      try {
        const rejectionsResult = await evaluationService.kraKpiRejections.get({
          employee_id: employeeId,
          cycle_id: activeCycle.id,
          quarter: q,
        });
        
        const rejectionsMap: Record<string, any> = {};
        (rejectionsResult.data || []).forEach((rejection: any) => {
          const key = rejection.kra_id || rejection.goal_id;
          if (key) {
            if (!rejectionsMap[key] || new Date(rejection.rejected_at) > new Date(rejectionsMap[key].rejected_at)) {
              rejectionsMap[key] = rejection;
            }
          }
        });
        
        setKraKpiRejections(prev => ({
          ...prev,
          [q]: rejectionsMap,
        }));
      } catch (error) {
        console.error('Error refetching rejections after submission:', error);
      }
    }
  }, [activeQuarter, getCurrentPeriodComments, evalOps, calculateOverallRatingForQuarter, employeeId, activeCycle?.id]);

  const handleNext = useCallback(async () => {
    const q = activeQuarter;
    const calculatedRating = calculateOverallRatingForQuarter(q);
    const currentComments = getCurrentPeriodComments(q);
    await evalOps.saveProgress(q, currentComments, calculatedRating ?? undefined, setQuarterlyReviews);
    setEvaluationTab(prev => ({ ...prev, [q]: 'overall' }));
  }, [activeQuarter, getCurrentPeriodComments, evalOps, calculateOverallRatingForQuarter]);

  const handleTabChange = useCallback((quarter: number, value: string) => {
    setEvaluationTab(prev => ({ ...prev, [quarter]: value }));
  }, []);

  // Computed values - use URL quarter if available, otherwise use selectedQuarter
  const q = activeQuarter;

  // Loading state
  if (loading) {
    return <MainLayout><PageLoader /></MainLayout>;
  }

  // No employee profile (non-HR)
  if (!employeeId && !isHR) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Your employee profile is not set up. Please contact HR.</AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  // HR user without profile
  if (!employeeId && isHR) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Self Evaluation</h1>
            <p className="text-muted-foreground">Employee self-evaluation portal</p>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              As an HR user, you can view employee evaluations from the Reports page or Team page.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  // No active cycle
  if (!activeCycle) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No active performance cycle. Please contact HR.</AlertDescription>
        </Alert>
      </MainLayout>
    );
  }


  // Determine what content to render for the selected quarter
  const renderQuarterContent = (quarterNum: number, isTransition: boolean = false) => {
    const qTiming = getQuarterTiming(activeCycle, quarterNum, quarterlyCycles);
    const qHasGoals = (quarterKras[quarterNum] || []).length > 0 && (quarterKpis[quarterNum] || []).length > 0;
    const qKras = quarterKras[quarterNum] || [];
    const qKpis = quarterKpis[quarterNum] || [];
    const qHasLatePermission = latePermissions[quarterNum] || false;
    const qEnded = hasQuarterEnded(activeCycle as CycleWithQuarterDates, quarterNum, quarterlyCycles);
    const qEndDate = getQuarterEndDateFromCycle(activeCycle as CycleWithQuarterDates, quarterNum, quarterlyCycles);
    
    // Check if this quarter has a transition
    // Use transitions state (which has all quarters) instead of transition hook (which only has active quarter)
    const qTransition = transitions[quarterNum] || (transition && transition.quarter === quarterNum ? transition : null);
    
    // Debug logging
    if (qTransition) {
      console.log('[Evaluations] Filtering goals for transition:', {
        quarter: quarterNum,
        transitionId: qTransition.id,
        transitionIdType: typeof qTransition.id,
        totalKras: qKras.length,
        totalKpis: qKpis.length,
        allKras: qKras.map(k => ({ 
          id: k.id, 
          period_type: k.period_type, 
          transition_id: k.transition_id,
          transition_id_type: typeof k.transition_id,
          status: k.status,
          quarter: k.quarter
        })),
        allKpis: qKpis.map(k => ({ 
          id: k.id, 
          period_type: k.period_type, 
          transition_id: k.transition_id,
          transition_id_type: typeof k.transition_id,
          status: k.status,
          quarter: k.quarter
        })),
      });
    }
    
    // Separate goals by period if transition exists
    // For pre-transition: show goals with period_type='pre_transition' AND transition_id matches,
    // OR goals where transition_id IS NULL, OR goals with period_type='full_quarter'
    // (these are the old goals that should be shown in pre-transition)
    // For post-transition: show goals with period_type='post_transition' AND transition_id matches
    const transitionIdStr = qTransition ? String(qTransition.id) : null;
    const preTransitionKras = qTransition 
      ? qKras.filter(k => {
          // Include if:
          // 1. transition_id IS NULL (old goals)
          // 2. period_type = 'full_quarter' (fallback)
          // 3. period_type = 'pre_transition' AND transition_id matches
          if (!k.transition_id) {
            // Goals with null transition_id should be shown in pre-transition tab
            return true;
          }
          if (k.period_type === 'full_quarter') {
            // Goals with full_quarter period_type should be shown in pre-transition tab
            return true;
          }
          const periodMatch = k.period_type === 'pre_transition';
          const transitionMatch = String(k.transition_id) === transitionIdStr;
          return periodMatch && transitionMatch;
        })
      : [];
    
    const preTransitionKpis = qTransition
      ? qKpis.filter(k => {
          // Include if:
          // 1. transition_id IS NULL (old goals)
          // 2. period_type = 'full_quarter' (fallback)
          // 3. period_type = 'pre_transition' AND transition_id matches
          if (!k.transition_id) {
            // Goals with null transition_id should be shown in pre-transition tab
            return true;
          }
          if (k.period_type === 'full_quarter') {
            // Goals with full_quarter period_type should be shown in pre-transition tab
            return true;
          }
          const periodMatch = k.period_type === 'pre_transition';
          const transitionMatch = String(k.transition_id) === transitionIdStr;
          return periodMatch && transitionMatch;
        })
      : [];
    
    const postTransitionKras = qTransition
      ? qKras.filter(k => {
          // Only show post-transition goals with matching transition_id
          const periodMatch = k.period_type === 'post_transition';
          const transitionMatch = k.transition_id ? String(k.transition_id) === transitionIdStr : false;
          return periodMatch && transitionMatch;
        })
      : [];
    
    const postTransitionKpis = qTransition
      ? qKpis.filter(k => {
          // Only show post-transition goals with matching transition_id
          const periodMatch = k.period_type === 'post_transition';
          const transitionMatch = k.transition_id ? String(k.transition_id) === transitionIdStr : false;
          return periodMatch && transitionMatch;
        })
      : [];
    
    // If no transition, show all goals (including those with null transition_id)
    const fullQuarterKras = qTransition
      ? []
      : qKras.filter(k => !k.period_type || k.period_type === 'full_quarter' || !k.transition_id);
    
    const fullQuarterKpis = qTransition
      ? []
      : qKpis.filter(k => !k.period_type || k.period_type === 'full_quarter' || !k.transition_id);
    
    // Debug logging for filtered results
    if (qTransition) {
      console.log('[Evaluations] Filtered goals:', {
        preTransitionKras: preTransitionKras.length,
        preTransitionKpis: preTransitionKpis.length,
        postTransitionKras: postTransitionKras.length,
        postTransitionKpis: postTransitionKpis.length,
        preTransitionKraIds: preTransitionKras.map(k => k.id),
        preTransitionKpiIds: preTransitionKpis.map(k => k.id),
        goalsWithNullTransitionId: {
          kras: qKras.filter(k => !k.transition_id).length,
          kpis: qKpis.filter(k => !k.transition_id).length,
        },
        goalsWithFullQuarter: {
          kras: qKras.filter(k => k.period_type === 'full_quarter').length,
          kpis: qKpis.filter(k => k.period_type === 'full_quarter').length,
        }
      });
    } else {
      console.log('[Evaluations] No transition for quarter:', {
        quarter: quarterNum,
        totalKras: qKras.length,
        totalKpis: qKpis.length,
        fullQuarterKras: fullQuarterKras.length,
        fullQuarterKpis: fullQuarterKpis.length,
        goalsWithNullTransitionId: {
          kras: qKras.filter(k => !k.transition_id).length,
          kpis: qKpis.filter(k => !k.transition_id).length,
        },
        goalsWithFullQuarter: {
          kras: qKras.filter(k => k.period_type === 'full_quarter').length,
          kpis: qKpis.filter(k => k.period_type === 'full_quarter').length,
        }
      });
    }

    // If quarter is in the future, show not accessible message
    if (qTiming === 'future') {
      const qDates = formatQuarterDates(activeCycle, quarterNum, quarterlyCycles);
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">Q{quarterNum} Self-Review Period is Not Open Yet</h3>
            <p className="text-muted-foreground text-center mt-2">
              {qDates 
                ? `The Q${quarterNum} self-review period will open from ${qDates.start} to ${qDates.end}.`
                : `The Q${quarterNum} self-review period has not been scheduled yet.`
              }
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Please check back when the review period begins.
            </p>
          </CardContent>
        </Card>
      );
    }

    // Check if employee has transition for this quarter
    const hasTransitionForQuarter = qTransition && qTransition.employee_id === employeeId;
    
    // Helper to check if current date is within quarter date range
    // Note: Using regular function, not useMemo, since this is inside a function that can return early
    const isWithinQuarterDates = (() => {
      if (!activeCycle || !quarterlyCycles) return false;
      
      // Find the quarterly cycle for this quarter
      const quarterlyCycle = quarterlyCycles.find(qc => qc.quarter === quarterNum);
      if (!quarterlyCycle?.quarter_start_date || !quarterlyCycle?.quarter_end_date) {
        return false;
      }
      
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const quarterStart = new Date(quarterlyCycle.quarter_start_date);
      quarterStart.setHours(0, 0, 0, 0);
      const quarterEnd = new Date(quarterlyCycle.quarter_end_date);
      quarterEnd.setHours(23, 59, 59, 999);
      
      return now >= quarterStart && now <= quarterEnd;
    })();
    
    // If quarter has ended and no late permission AND no transition, show message
    if (qEnded && !qHasLatePermission && !(hasTransitionForQuarter && isWithinQuarterDates)) {
      return <PeriodClose quarterNum={quarterNum} qEndDate={qEndDate} title="Self-Review" />
 
    }

    if (!qHasGoals) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">Please Complete Your Goals for Q{quarterNum}</h3>
            <p className="text-muted-foreground text-center mt-2">
              You need to create and get approval for your Q{quarterNum} goals before starting self evaluation.
            </p>
            <Button 
              className="mt-4" 
              onClick={() => window.location.href = `/goals?quarter=q${quarterNum}`}
            >
              Go to Goals
            </Button>
          </CardContent>
        </Card>
      );
    }
    

    let goalsApproved = false;
    if (qTransition) {
      // Transition employee: check goals for the specific period
      const periodType = isTransition ? 'post_transition' : 'pre_transition';
      const transitionIdStr = String(qTransition.id);
      
      // Get goals for the current period
      const periodKras = isTransition ? postTransitionKras : preTransitionKras;
      const periodKpis = isTransition ? postTransitionKpis : preTransitionKpis;
      
      // Check if goals for this period are approved
      const periodKrasApproved = periodKras.some(k => k.status === 'approved');
      const periodKpisApproved = periodKpis.some(k => k.status === 'approved');
      
      if (isTransition) {
        // For post-transition: if post-transition goals are not approved yet,
        // allow evaluation if pre-transition goals are approved
        if (!periodKrasApproved && !periodKpisApproved) {
          // Check if pre-transition goals are approved
          const preKrasApproved = preTransitionKras.some(k => k.status === 'approved');
          const preKpisApproved = preTransitionKpis.some(k => k.status === 'approved');
          goalsApproved = (preKrasApproved || preKpisApproved);
        } else {
          goalsApproved = (periodKrasApproved || periodKpisApproved);
        }
      } else {
        // For pre-transition: check if pre-transition goals are approved
        goalsApproved = (periodKrasApproved || periodKpisApproved);
      }
    } else {
      // Non-transition employee: check if any goals are approved
      const fullKrasApproved = fullQuarterKras.some(k => k.status === 'approved');
      const fullKpisApproved = fullQuarterKpis.some(k => k.status === 'approved');
      goalsApproved = (fullKrasApproved || fullKpisApproved);
    }
    
    if (!goalsApproved) {
      const periodLabel = qTransition 
        ? (isTransition ? 'post-transition' : 'pre-transition')
        : '';
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">
              {qTransition 
                ? `Please Wait for Manager Approval - Q${quarterNum} ${periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)} Goals`
                : `Please Wait for Manager Approval - Q${quarterNum} Goals`
              }
            </h3>
            <p className="text-muted-foreground text-center mt-2">
              {qTransition
                ? `Your ${periodLabel} goals for Q${quarterNum} must be approved by your manager before you can start self-evaluation.`
                : `Your Q${quarterNum} goals must be approved by your manager before you can start self-evaluation.`
              }
            </p>
            <Button 
              className="mt-4" 
              onClick={() => window.location.href = `/goals?quarter=q${quarterNum}`}
            >
              View Goals
            </Button>
          </CardContent>
        </Card>
      );
    }

    // For transitions, we need to get the correct review based on period_type
    // If working on post-transition KPIs, get post-transition review
    // If working on pre-transition KPIs, get pre-transition review
    // Otherwise, use the primary review (which defaults to post-transition if available)
    let qReview = quarterlyReviews[quarterNum];
    if (qTransition) {
      // Calculate period info directly based on isTransition parameter (not relying on currentQuarterPeriodInfo)
      // This ensures we use the correct period for the specific quarter being rendered
      const periodType = isTransition ? 'post_transition' : 'pre_transition';
      const transitionId = qTransition.id;
          
      // Find the review matching the current period from allReviewsByQuarter
      const allReviews = allReviewsByQuarter[quarterNum] || [];
      const matchingReview = allReviews.find((r: any) => 
        r.period_type === periodType && 
        String(r.transition_id) === String(transitionId)
      );
         
      if (matchingReview) {
        qReview = matchingReview;
      } else {
        // If no matching review found, set qReview to null so we can create a new one
        qReview = null;
      }
    }
    const qIsSubmitted = qReview?.status === 'submitted';
    
    // Use backend selfReview data to determine if quarter is open for self-review
    // If selfReview is available, check if this quarter is the review_for_quarter and enabled
    // Otherwise, fallback to date-based check
    // For transition employees, the selfReview from context should still indicate if the quarter is open
    const qIsOpen = selfReview 
      ? (selfReview.review_for_quarter === quarterNum && selfReview.enabled === true)
      : isQuarterOpen(activeCycle, quarterNum, quarterlyCycles);
    
    // For transition employees, pre-transition and post-transition are separate reviews
    // When in transition tab (post-transition), check the post-transition review status
    // When in pre-transition tab, check the pre-transition review status
    // The qReview is already set correctly based on currentQuarterPeriodInfo above
    
    // Debug logging for transition tab
    if (isTransition && qTransition) {

    }
    
    // Check for active rejections (not resubmitted) for this quarter
    const quarterRejections = kraKpiRejections[quarterNum] || {};
    const activeRejections = Object.values(quarterRejections).filter((r: any) => !r.resubmitted_at);
    const hasActiveRejections = activeRejections.length > 0;
    
    // Debug logging for rejections
    console.log('[Evaluations] Rejection check for Q' + quarterNum + ':', {
      quarterRejections,
      activeRejectionsCount: activeRejections.length,
      hasActiveRejections,
      rejectionKeys: Object.keys(quarterRejections),
    });
    
    // Allow editing if:
    // 1. Quarter is open OR
    // 2. Has late permission OR
    // 3. Has transition AND within quarter dates (bypass deadline check)
    // AND:
    // - The current period's review is not submitted (each period has its own review)
    // - OR if the review doesn't exist yet (qReview is null/undefined), allow editing
    // SPECIAL CASE: If there are active rejections, allow editing even if review is submitted
    // (employee needs to fix rejected items and resubmit)
    const baseCanEdit = (qIsOpen || qHasLatePermission || (hasTransitionForQuarter && isWithinQuarterDates));
    const qCanEdit = baseCanEdit && (hasActiveRejections || !qReview || !qIsSubmitted);
    
    console.log('[Evaluations] qCanEdit for Q' + quarterNum + ':', {
      qCanEdit,
      qIsOpen,
      qHasLatePermission,
      hasTransitionForQuarter,
      isWithinQuarterDates,
      qReview: qReview ? { id: qReview.id, status: qReview.status } : null,
      qIsSubmitted,
    });
    
    // Additional debug for transition tab
    if (isTransition && qTransition) {
      console.log('[Evaluations] Transition tab - qCanEdit:', qCanEdit, 'breakdown:', {
        condition1: qIsOpen,
        condition2: qHasLatePermission,
        condition3: hasTransitionForQuarter && isWithinQuarterDates,
        condition4: !qReview || !qIsSubmitted,
        final: qCanEdit
      });
    }
    
    // Determine which KRAs and KPIs to display
    // Determine which KRAs/KPIs to display based on tab
    const displayKras = isTransition ? postTransitionKras : 
                       (qTransition ? preTransitionKras : fullQuarterKras);
    const displayKpis = isTransition ? postTransitionKpis : 
                        (qTransition ? preTransitionKpis : fullQuarterKpis);
    
    // Filter ratings to only include ratings for the displayed KPIs
    const allQuarterRatings = kpiRatings[quarterNum] || {};
    const qKpiRatings: Record<string, KpiRating> = {};
    displayKpis.forEach(kpi => {
      if (allQuarterRatings[kpi.id]) {
        qKpiRatings[kpi.id] = allQuarterRatings[kpi.id];
      }
    });

    const qKpisWithKra: KPIForCalculation[] = displayKpis
      .filter((kpi): kpi is Goal & { kra_id: string } => !!kpi.kra_id)
      .map(kpi => ({
        id: kpi.id,
        kra_id: kpi.kra_id,
        weight: kpi.weight,
      }));

    const qKpiRatingsForCalc: Record<string, number | null> = {};
    displayKpis.forEach(kpi => {
      const achievedValue = qKpiRatings[kpi.id]?.achieved_value;
      if (kpi.calibration && kpi.calibration.length > 0 && achievedValue !== null && achievedValue !== undefined) {
        qKpiRatingsForCalc[kpi.id] = calculateRatingFromCalibration(achievedValue, kpi.calibration);
      } else {
        qKpiRatingsForCalc[kpi.id] = qKpiRatings[kpi.id]?.self_rating || null;
      }
    });

    const qKraRatings = calculateAllKRARatings(displayKras, qKpisWithKra, qKpiRatingsForCalc);
    const qOverallCalc = calculateQuarterRating(displayKras, qKraRatings);
    
    // Use performance cycle year (matches backend validation)
    // Backend validates year against cycle year, not quarter calendar year
    const quarterYear = activeCycle?.year || new Date().getFullYear();
    
    return (
      <>
        <QuarterAlerts
          quarter={quarterNum}
          cycle={activeCycle}
          quarterlyCycles={quarterlyCycles}
          isSubmitted={qIsSubmitted}
        />
        
        {/* Rejection Alert */}
        {hasActiveRejections && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <div className="font-semibold mb-2">Some KRAs/KPIs have been rejected by your manager</div>
              <div className="text-sm">
                You can only edit the rejected items below. Please review the manager feedback, make necessary updates, and resubmit.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Transition Alert */}
        {qTransition && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold">Mid-Quarter Transition Detected</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    Transition Date: {formatDateShort(new Date(qTransition.transition_date))} • 
                    Type: {qTransition.transition_type}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={getPeriodBadgeVariant('pre_transition')}>
                    {getPeriodLabel('pre_transition')}
                  </Badge>
                  <ArrowRight className="h-4 w-4" />
                  <Badge variant={getPeriodBadgeVariant('post_transition')}>
                    {getPeriodLabel('post_transition')}
                  </Badge>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Late permission notice */}
        {qEnded && qHasLatePermission && !qIsSubmitted && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-3">
              <p className="text-sm text-amber-800">
                <AlertTriangle className="inline h-4 w-4 mr-2" />
                You have been granted late submission access for Q{quarterNum} by HR/Admin.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs 
          value={evaluationTab[quarterNum] || 'goals'} 
          onValueChange={(value) => handleTabChange(quarterNum, value)}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="goals">KRA/KPI Ratings ({qKpis.length})</TabsTrigger>
            <TabsTrigger value="overall">Overall Assessment</TabsTrigger>
          </TabsList>

          <TabsContent value="goals" className="space-y-6">
            {qTransition ? (
              <>
                {/* Show pre-transition in regular tab, post-transition in transition tab */}
                {!isTransition && preTransitionKras.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Badge variant={getPeriodBadgeVariant('pre_transition')}>
                        {getPeriodLabel('pre_transition')}
                      </Badge>
                      {qTransition.pre_period_start_date && qTransition.pre_period_end_date && (
                        <span className="text-sm text-muted-foreground">
                          {formatPeriodDateRange(qTransition.pre_period_start_date, qTransition.pre_period_end_date)}
                        </span>
                      )}
                    </div>
                    {preTransitionKras.map(kra => (
                      <KRAEvaluationCard
                        key={kra.id}
                        kra={kra}
                        kpis={preTransitionKpis.filter(kpi => kpi.kra_id === kra.id)}
                        goalRatings={qKpiRatings}
                        kraRating={qKraRatings[kra.id]}
                        ratingScales={ratingScales}
                        canEdit={qCanEdit}
                        onRatingChange={handleKpiRatingChange}
                        empCode={currentEmployee?.emp_code}
                        quarter={quarterNum}
                        year={quarterYear}
                        employeeId={employeeId || undefined}
                        kraKpiRejections={quarterRejections}
                        hasActiveRejections={hasActiveRejections}
                      />
                    ))}
                  </div>
                )}
                
                {isTransition && postTransitionKras.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Badge variant={getPeriodBadgeVariant('post_transition')}>
                        {getPeriodLabel('post_transition')}
                      </Badge>
                      {qTransition.post_period_start_date && qTransition.post_period_end_date && (
                        <span className="text-sm text-muted-foreground">
                          {formatPeriodDateRange(qTransition.post_period_start_date, qTransition.post_period_end_date)}
                        </span>
                      )}
                    </div>
                    {postTransitionKras.map(kra => (
                      <KRAEvaluationCard
                        key={kra.id}
                        kra={kra}
                        kpis={postTransitionKpis.filter(kpi => kpi.kra_id === kra.id)}
                        goalRatings={qKpiRatings}
                        kraRating={qKraRatings[kra.id]}
                        ratingScales={ratingScales}
                        canEdit={qCanEdit}
                        onRatingChange={handleKpiRatingChange}
                        empCode={currentEmployee?.emp_code}
                        quarter={quarterNum}
                        year={quarterYear}
                        employeeId={employeeId || undefined}
                        kraKpiRejections={quarterRejections}
                        hasActiveRejections={hasActiveRejections}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Full Quarter (No Transition) */
              displayKras.map(kra => (
                <KRAEvaluationCard
                  key={kra.id}
                  kra={kra}
                  kpis={displayKpis.filter(kpi => kpi.kra_id === kra.id)}
                  goalRatings={qKpiRatings}
                  kraRating={qKraRatings[kra.id]}
                  ratingScales={ratingScales}
                  canEdit={qCanEdit}
                  onRatingChange={handleKpiRatingChange}
                  empCode={currentEmployee?.emp_code}
                  quarter={quarterNum}
                  year={activeCycle?.year}
                  employeeId={employeeId || undefined}
                  kraKpiRejections={quarterRejections}
                  hasActiveRejections={hasActiveRejections}
                />
              ))
            )}
            

            {/* Show buttons if: canEdit AND (not submitted OR has active rejections) */}
            {qCanEdit && (!qIsSubmitted || hasActiveRejections) && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={handleSave} 
                  disabled={evalOps.saving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button 
                  onClick={handleNext}
                  disabled={evalOps.saving}
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="overall" className="space-y-4">
            <OverallAssessmentTab
              quarter={quarterNum}
              calculatedRating={qOverallCalc}
              overallComments={(() => {
                // Get period-specific comments for this quarter and period
                const qTransition = transitions[quarterNum] || (transition && transition.quarter === quarterNum ? transition : null);
                const periodType = isTransition ? 'post_transition' : 'pre_transition';
                
                if (qTransition) {
                  return overallComments[quarterNum]?.[periodType] || '';
                } else {
                  return overallComments[quarterNum]?.pre_transition || '';
                }
              })()}
              canEdit={qCanEdit}
              onCommentsChange={(newComments: string) => {
                const qTransition = transitions[quarterNum] || (transition && transition.quarter === quarterNum ? transition : null);
                const periodType = isTransition ? 'post_transition' : 'pre_transition';
                
                setOverallComments(prev => ({
                  ...prev,
                  [quarterNum]: {
                    ...prev[quarterNum],
                    [periodType]: newComments
                  }
                }));
              }}
            />
            
            {/* Debug logging for Overall Assessment tab */}
            {isTransition && qTransition && (() => {
              console.log('[Evaluations] Overall Assessment tab - transition tab:', {
                quarter: quarterNum,
                isTransition: isTransition,
                qReview: qReview,
                qIsSubmitted: qIsSubmitted,
                qCanEdit: qCanEdit,
                showButtons: qCanEdit && (!qIsSubmitted || hasActiveRejections),
                periodType: isTransition ? 'post_transition' : 'pre_transition',
                transitionId: qTransition.id
              });
              return null;
            })()}
            
            {/* Action Buttons for Overall Assessment Tab */}
            {/* Show buttons if: canEdit AND (not submitted OR has active rejections) */}
            {qCanEdit && (!qIsSubmitted || hasActiveRejections) && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={handleSave} 
                  disabled={evalOps.saving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={evalOps.saving}
                  className="bg-blue-600 text-white hover:bg-blue-700/90"
                >
                  <Send className="mr-2 h-4 w-4 " />
                  Submit
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Self Evaluation</h1>
          <p className="text-muted-foreground">{activeCycle.name}</p>
        </div>

        <Tabs 
          value={selectedQuarter} 
          onValueChange={(value) => {
              const quarterNum = parseInt(value);
            if (quarterNum >= 1 && quarterNum <= 4) {
              setSelectedQuarter(String(quarterNum));
              setQuarter(quarterNum as 1 | 2 | 3 | 4);
              // Reset nested tab to pre-transition when switching quarters
              setNestedTab('pre-transition');
              setSearchParams(prev => {
                const newParams = new URLSearchParams(prev);
                newParams.set('quarter', String(quarterNum));
                newParams.delete('transition');
                return newParams;
              }, { replace: true });
            }
          }}
          className="space-y-4"
        >
          <TabsList className="grid w-full" style={{ 
            gridTemplateColumns: `repeat(4, 1fr)` 
          }}>
            {[1, 2, 3, 4].map(quarterNum => {
              // Use backend response to determine if self review is enabled for this quarter
              // Enable tab if: it's the review_for_quarter AND self_review.enabled is true
              // OR if self evaluation already exists for this quarter (allow viewing past reviews)
              const isReviewQuarter = selfReview?.review_for_quarter === quarterNum;
              const isSelfReviewEnabled = isReviewQuarter && selfReview?.enabled === true;
              
              // Check if self evaluation exists for this quarter (to allow viewing past reviews)
              const hasSelfEvalForQuarter = initialQuarterlyReviews && 
                Object.values(initialQuarterlyReviews).some((review: any) => 
                  review && review.quarter === quarterNum
                );
              
              // Enable tab if self review is enabled OR if self evaluation already exists
              // Fallback to date calculation if backend data not available
              const isTabEnabled = selfReview 
                ? (isSelfReviewEnabled || hasSelfEvalForQuarter)
                : (getQuarterTiming(activeCycle, quarterNum, quarterlyCycles) !== 'future');
              
              return (
                  <TabsTrigger 
                  key={quarterNum}
                    value={String(quarterNum)} 
                  disabled={!isTabEnabled}
                    className="flex items-center gap-2"
                  >
                    Q{quarterNum}
                  </TabsTrigger>
              );
            })}
          </TabsList>
          
          {[1, 2, 3, 4].map(quarterNum => {
            // Check if this quarter has a transition
            const quarterTransition = transitions[quarterNum];
            const hasTransition = !!quarterTransition;
            
            return (
              <TabsContent key={quarterNum} value={String(quarterNum)} className="space-y-4">
                {/* Nested Tabs for Pre-Transition and Transition (if transition exists) */}
                {hasTransition ? (
                  <Tabs 
                    value={quarterNum === parseInt(selectedQuarter) ? nestedTab : 'pre-transition'} 
                    onValueChange={(value) => {
                      if (quarterNum === parseInt(selectedQuarter)) {
                        setNestedTab(value as 'pre-transition' | 'transition');
                        setSearchParams(prev => {
                          const newParams = new URLSearchParams(prev);
                          if (value === 'transition') {
                            newParams.set('transition', 'true');
                          } else {
                            newParams.delete('transition');
                          }
                          return newParams;
                        }, { replace: true });
                      }
                    }}
                    className="space-y-4"
                  >
                    <TabsList>
                      <TabsTrigger value="pre-transition">Pre-Transition</TabsTrigger>
                      <TabsTrigger value="transition">Transition</TabsTrigger>
                    </TabsList>
                    
                    {/* Pre-Transition Tab Content */}
                    <TabsContent value="pre-transition" className="space-y-4">
                      {quarterNum === parseInt(selectedQuarter) && nestedTab === 'pre-transition' && (
                        renderQuarterContent(quarterNum, false)
                      )}
                    </TabsContent>
                    
                    {/* Transition Tab Content */}
                    <TabsContent value="transition" className="space-y-4">
                      {quarterNum === parseInt(selectedQuarter) && nestedTab === 'transition' && (
                        renderQuarterContent(quarterNum, true)
                      )}
                    </TabsContent>
                  </Tabs>
                ) : (
                  /* No Transition - Show regular content */
                  renderQuarterContent(quarterNum, false)
              )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </MainLayout>
  );
}
