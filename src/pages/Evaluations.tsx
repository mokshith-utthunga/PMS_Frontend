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
import { Save, Send, Target, AlertCircle, ChevronRight, Calendar, AlertTriangle, ArrowRight } from 'lucide-react';
import { PageLoader } from '@/loaders';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
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

  // URL-based quarter handling
  const { quarter, setQuarter, isValidQuarter } = useQuarterFromUrl();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local state for form data - sync with URL quarter
  // Initialize with URL quarter if available, otherwise default to '1'
  const [selectedQuarter, setSelectedQuarter] = useState<string>(() => {
    if (quarter) return String(quarter);
    return '1';
  });
  
  // State to track if we're viewing the transition tab - read from URL
  const isTransitionTabFromUrl = searchParams.get('transition') === 'true';
  const [isTransitionTab, setIsTransitionTab] = useState(isTransitionTabFromUrl);
  
  // Sync transition tab state with URL
  useEffect(() => {
    setIsTransitionTab(isTransitionTabFromUrl);
  }, [isTransitionTabFromUrl]);

  // Fetch evaluations data with selected quarter
  // Use URL quarter if available, otherwise use selectedQuarter
  // Note: useEvaluationsData fetches all quarters, but we pass selectedQuarter for context
  const quarterForFetch = quarter || parseInt(selectedQuarter) || 1;
  const evalData = useEvaluationsData(user?.id, quarterForFetch);
  const {
    employeeId, activeCycle, quarterlyCycles, ratingScales,
    quarterlyReviews: initialQuarterlyReviews,
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
  
  // Clean up URL if transition parameter exists but no active transition
  useEffect(() => {
    if (isTransitionTabFromUrl && !transition) {
      // Remove transition parameter if no active transition exists
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('transition');
        return newParams;
      }, { replace: true });
    }
  }, [isTransitionTabFromUrl, transition, setSearchParams]);
  
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
  const [overallComments, setOverallComments] = useState('');
  const [evaluationTab, setEvaluationTab] = useState<Record<number, string>>({});

  useEffect(() => {
    setQuarterlyReviews(initialQuarterlyReviews);
    setKpiRatings(initialKpiRatings);
  }, [initialQuarterlyReviews, initialKpiRatings]);

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
    const review = quarterlyReviews[q];
    if (review) {
      setOverallComments(review.overall_comments || '');
    } else {
      setOverallComments('');
    }

    setEvaluationTab(prev => {
      if (!prev[q]) {
        return { ...prev, [q]: 'goals' };
      }
      return prev;
    });
  }, [selectedQuarter, quarterlyReviews, setQuarter, quarter]);

  // Use URL quarter if available, otherwise use selectedQuarter
  const activeQuarter = quarter || parseInt(selectedQuarter) || 1;
  
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

  // Determine period info for the current quarter based on transition and KPIs being rated
  // This determines which period-specific review to save to
  const currentQuarterPeriodInfo = useMemo(() => {
    const q = activeQuarter;
    const qTransition = transition && transition.quarter === q ? transition : null;
    
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
  }, [activeQuarter, transition, quarterlyCycles, isTransitionTab]);

  const evalOps = useEvaluationOperations({
    employeeId,
    cycleId: activeCycle?.id || null,
    quarterlyReviews,
    kpiRatings,
    kpis: currentQuarterKpis,
    onSuccess: refetch,
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

  const handleSave = useCallback(() => {
    const q = activeQuarter;
    const calculatedRating = calculateOverallRatingForQuarter(q);
    evalOps.saveProgress(q, overallComments, calculatedRating ?? undefined, setQuarterlyReviews);
  }, [activeQuarter, overallComments, evalOps, calculateOverallRatingForQuarter]);

  const handleSubmit = useCallback(() => {
    const q = activeQuarter;
    const calculatedRating = calculateOverallRatingForQuarter(q);
    evalOps.submitEvaluation(q, overallComments, calculatedRating ?? undefined, setQuarterlyReviews);
  }, [activeQuarter, overallComments, evalOps, calculateOverallRatingForQuarter]);

  const handleNext = useCallback(async () => {
    const q = activeQuarter;
    const calculatedRating = calculateOverallRatingForQuarter(q);
    await evalOps.saveProgress(q, overallComments, calculatedRating ?? undefined, setQuarterlyReviews);
    setEvaluationTab(prev => ({ ...prev, [q]: 'overall' }));
  }, [activeQuarter, overallComments, evalOps, calculateOverallRatingForQuarter]);

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
    const qTransition = transition && transition.quarter === quarterNum ? transition : null;
    
    // Separate goals by period if transition exists
    const preTransitionKras = qTransition 
      ? qKras.filter(k => k.period_type === 'pre_transition' && k.transition_id === qTransition.id)
      : [];
    
    const preTransitionKpis = qTransition
      ? qKpis.filter(k => k.period_type === 'pre_transition' && k.transition_id === qTransition.id)
      : [];
    
    const postTransitionKras = qTransition
      ? qKras.filter(k => k.period_type === 'post_transition' && k.transition_id === qTransition.id)
      : [];
    
    const postTransitionKpis = qTransition
      ? qKpis.filter(k => k.period_type === 'post_transition' && k.transition_id === qTransition.id)
      : [];
    
    const fullQuarterKras = qTransition
      ? []
      : qKras.filter(k => !k.period_type || k.period_type === 'full_quarter');
    
    const fullQuarterKpis = qTransition
      ? []
      : qKpis.filter(k => !k.period_type || k.period_type === 'full_quarter');

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

    // Quarter has goals and is accessible (or has late permission) - show evaluation content
    const qIsOpen = isQuarterOpen(activeCycle, quarterNum, quarterlyCycles);
    
    // For transitions, we need to get the correct review based on period_type
    // If working on post-transition KPIs, get post-transition review
    // If working on pre-transition KPIs, get pre-transition review
    // Otherwise, use the primary review (which defaults to post-transition if available)
    let qReview = quarterlyReviews[quarterNum];
    if (qTransition) {
      // Fetch the specific review for the period we're working on
      const periodInfo = currentQuarterPeriodInfo;
      if (periodInfo.periodType && periodInfo.transitionId) {
        // Try to find the review matching the current period
        // We'll need to fetch it or get it from the reviews array
        // For now, use the primary review and let the backend handle period-specific saves
        // The issue is that quarterlyReviews only stores one review per quarter
        // We'll need to update useEvaluationsData to return all reviews, then select the right one here
      }
    }
    const qIsSubmitted = qReview?.status === 'submitted';
    
    // For post-transition period, we should allow editing even if pre-transition review is submitted
    // because they are separate reviews. The backend creates separate reviews for each period_type.
    // For now, if we're in post-transition period and have transition, allow editing regardless of review status
    // (The backend will handle creating/updating the correct period-specific review)
    const isPostTransitionPeriod = hasTransitionForQuarter && postTransitionKras.length > 0;
    
    // Allow editing if:
    // 1. Quarter is open OR
    // 2. Has late permission OR
    // 3. Has transition AND within quarter dates (bypass deadline check)
    // AND:
    // - For post-transition period: always allow (backend handles period-specific reviews)
    // - For other periods: only allow if review not submitted
    const qCanEdit = (qIsOpen || qHasLatePermission || (hasTransitionForQuarter && isWithinQuarterDates)) && 
                     (isPostTransitionPeriod ? true : !qIsSubmitted);
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
    const qOverallCalc = calculateQuarterRating(qKras, qKraRatings);
    
    // Determine which KRAs and KPIs to display
    // Determine which KRAs/KPIs to display based on tab
    const displayKras = isTransition ? postTransitionKras : 
                       (qTransition ? preTransitionKras : fullQuarterKras);
    const displayKpis = isTransition ? postTransitionKpis : 
                        (qTransition ? preTransitionKpis : fullQuarterKpis);
    
    return (
      <>
        <QuarterAlerts
          quarter={quarterNum}
          cycle={activeCycle}
          quarterlyCycles={quarterlyCycles}
          isSubmitted={qIsSubmitted}
        />
        
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
                />
              ))
            )}
            

            {qCanEdit && !qIsSubmitted && (
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
              overallComments={quarterNum === q ? overallComments : ''}
              canEdit={qCanEdit}
              onCommentsChange={setOverallComments}
            />
            
            {/* Action Buttons for Overall Assessment Tab */}
            {qCanEdit && !qIsSubmitted && (
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
          value={isTransitionTab ? `q${activeQuarter}-transition` : String(activeQuarter)} 
          onValueChange={(value) => {
            if (value.endsWith('-transition')) {
              // Transition tab selected
              const quarterNum = parseInt(value.replace('-transition', '').replace('q', ''));
              setSelectedQuarter(String(quarterNum));
              setQuarter(quarterNum as 1 | 2 | 3 | 4);
              setSearchParams(prev => {
                const newParams = new URLSearchParams(prev);
                newParams.set('quarter', String(quarterNum));
                newParams.set('transition', 'true');
                return newParams;
              }, { replace: true });
            } else {
              // Regular quarter tab selected
              const quarterNum = parseInt(value);
              setSelectedQuarter(String(quarterNum));
              setQuarter(quarterNum as 1 | 2 | 3 | 4);
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
            gridTemplateColumns: `repeat(${4 + Object.keys(transitions).length}, 1fr)` 
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
              
              const hasTransition = !!transitions[quarterNum];
              
              return (
                <React.Fragment key={quarterNum}>
                  <TabsTrigger 
                    value={String(quarterNum)} 
                    disabled={!isTabEnabled}
                    className="flex items-center gap-2"
                  >
                    Q{quarterNum}
                  </TabsTrigger>
                  {hasTransition && (
                    <TabsTrigger 
                      key={`${quarterNum}-transition`}
                      value={`q${quarterNum}-transition`}
                      disabled={!isTabEnabled}
                      className="flex items-center gap-2"
                    >
                      Transition
                    </TabsTrigger>
                  )}
                </React.Fragment>
              );
            })}
          </TabsList>
          
          {[1, 2, 3, 4].map(quarterNum => (
            <React.Fragment key={quarterNum}>
              <TabsContent value={String(quarterNum)} className="space-y-4">
                {renderQuarterContent(quarterNum, false)}
              </TabsContent>
              {transitions[quarterNum] && (
                <TabsContent value={`q${quarterNum}-transition`} className="space-y-4">
                  {renderQuarterContent(quarterNum, true)}
                </TabsContent>
              )}
            </React.Fragment>
          ))}
        </Tabs>
      </div>
    </MainLayout>
  );
}
