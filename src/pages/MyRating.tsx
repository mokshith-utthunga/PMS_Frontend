import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { goalsService, evaluationService, settingsService, transitionService } from '@/services';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { useTransition } from '@/hooks/useTransition';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getPeriodLabel, getPeriodBadgeVariant, formatPeriodDateRange } from '@/utils/periodHelpers';
import { 
  Loader2, 
  Star,
  CheckCircle,
  Target,
  TrendingUp,
  AlertCircle,
  MessageSquare,
  Calculator,
  CalendarDays,
  XCircle,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatRating, calculateAllKRARatings, calculateKRARating } from '@/lib/ratingCalculations';
import type { YearEndEvaluationData } from '@/services/evaluation.service';

interface GoalRating {
  id: string;
  title: string;
  weight: number;
  goal_type: string;
  self_rating: number | null;
  manager_rating: number | null;
  manager_comments: string | null;
  kra_id?: string | null;
  quarter?: number | null;
}

interface KRARating {
  id: string;
  title: string;
  weight: number;
  self_rating: number | null;
  manager_rating: number | null;
  quarter?: number | null;
}

interface RatingScaleDisplay {
  value: number;
  name: string;
  description: string | null;
  color: string | null;
}

type EvaluationState = 
  | 'no_self_eval'           // Employee hasn't submitted self-evaluation
  | 'manager_pending'         // Self-eval submitted, manager review pending
  | 'hr_pending'             // Manager submitted, HR approval pending
  | 'hr_approved'            // HR approved, employee can accept/reject
  | 'employee_accepted'      // Employee accepted rating
  | 'employee_rejected';     // Employee rejected rating

type YearEndEvaluationState = 
  | 'no_data'                 // No year-end evaluation data
  | 'manager_pending'         // Manager hasn't submitted year-end evaluation
  | 'hr_pending'             // Manager submitted, HR approval pending
  | 'hr_approved'            // HR approved, employee can accept/reject
  | 'employee_accepted'      // Employee accepted rating
  | 'employee_rejected';     // Employee rejected rating

export default function MyRating() {
  const { user, hasAnyRole } = useAuth();
  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin']);
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get active cycle from context (fetched once at app initialization)
  const { activeCycle: activeCycleFromContext } = useActiveCycle();
  // Get current employee from cached hook (fetched once at app initialization)
  const { employee: currentEmployee } = useCurrentEmployee();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(currentEmployee?.id || null);
  const [employee, setEmployee] = useState<any>(currentEmployee);
  const [activeCycle, setActiveCycle] = useState<any>(activeCycleFromContext);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('1');
  const [viewMode, setViewMode] = useState<'quarterly' | 'year-end'>('quarterly');
  const [isTransitionTab, setIsTransitionTab] = useState(false);
  
  // Transition data - fetch transitions for all quarters
  const [transitions, setTransitions] = useState<Record<number, any>>({});
  
  // Evaluation data
  const [selfReview, setSelfReview] = useState<any>(null);
  const [managerReview, setManagerReview] = useState<any>(null);
  const [calibratedRating, setCalibratedRating] = useState<number | null>(null);
  const [goalRatings, setGoalRatings] = useState<GoalRating[]>([]);
  const [kraRatings, setKraRatings] = useState<KRARating[]>([]);
  const [kras, setKras] = useState<any[]>([]);
  const [ratingScales, setRatingScales] = useState<RatingScaleDisplay[]>([]);
  const [evaluationState, setEvaluationState] = useState<EvaluationState>('no_self_eval');
  
  // Period-specific data for transitions
  const [preTransitionSelfReview, setPreTransitionSelfReview] = useState<any>(null);
  const [postTransitionSelfReview, setPostTransitionSelfReview] = useState<any>(null);
  const [preTransitionManagerReview, setPreTransitionManagerReview] = useState<any>(null);
  const [postTransitionManagerReview, setPostTransitionManagerReview] = useState<any>(null);
  const [preTransitionGoalRatings, setPreTransitionGoalRatings] = useState<GoalRating[]>([]);
  const [postTransitionGoalRatings, setPostTransitionGoalRatings] = useState<GoalRating[]>([]);
  const [preTransitionKraRatings, setPreTransitionKraRatings] = useState<KRARating[]>([]);
  const [postTransitionKraRatings, setPostTransitionKraRatings] = useState<KRARating[]>([]);
  const [preTransitionCalibratedRating, setPreTransitionCalibratedRating] = useState<number | null>(null);
  const [postTransitionCalibratedRating, setPostTransitionCalibratedRating] = useState<number | null>(null);
  
  // Year-end evaluation data
  const [yearEndEvaluation, setYearEndEvaluation] = useState<YearEndEvaluationData | null>(null);
  const [yearEndState, setYearEndState] = useState<YearEndEvaluationState>('no_data');
  
  // Rejection modal state
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [showRejectionConfirmation, setShowRejectionConfirmation] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isYearEndRejection, setIsYearEndRejection] = useState(false);
  
  // Track expanded KRAs
  const [expandedKRAs, setExpandedKRAs] = useState<Record<string, boolean>>({});

  // Initialize quarter from URL or default to 1
  useEffect(() => {
    const quarterParam = searchParams.get('quarter');
    const transitionParam = searchParams.get('transition');
    if (quarterParam === 'year-end') {
      setViewMode('year-end');
      setIsTransitionTab(false);
    } else if (quarterParam && ['1', '2', '3', '4'].includes(quarterParam)) {
      setViewMode('quarterly');
      setSelectedQuarter(quarterParam);
      setIsTransitionTab(transitionParam === 'true');
    }
  }, [searchParams]);
  
  // Fetch transitions for all quarters
  useEffect(() => {
    const fetchTransitions = async () => {
      if (!currentEmployee?.id || !activeCycleFromContext?.id) return;
      
      const transitionsMap: Record<number, any> = {};
      for (let q = 1; q <= 4; q++) {
        try {
          const result = await transitionService.getByEmployee(
            currentEmployee.id,
            activeCycleFromContext.id,
            q
          );
          if (result && result.length > 0) {
            transitionsMap[q] = result[0];
          }
        } catch (error) {
          // No transition for this quarter
        }
      }
      setTransitions(transitionsMap);
    };
    
    fetchTransitions();
  }, [currentEmployee?.id, activeCycleFromContext?.id]);

  // Update activeCycle when context data changes
  useEffect(() => {
    if (activeCycleFromContext) {
      setActiveCycle(activeCycleFromContext);
    }
  }, [activeCycleFromContext]);

  const fetchData = useCallback(async () => {
    if (!user || !currentEmployee) return;

    try {
      setLoading(true);
      
      const employeeId = currentEmployee.id;
      const employee = currentEmployee;

      // Get rating scales
      const scalesResult = await settingsService.ratingScales.getDefault();
      const scales = (scalesResult.data || []).map((s: any) => ({
        value: s.rating ?? s.value,
        name: s.label ?? s.name,
        description: s.description || null,
        color: s.color || null,
      }));
      setRatingScales(scales.sort((a, b) => b.value - a.value));

      // Use active cycle from context (already fetched at app initialization)
      const currentActiveCycle = activeCycleFromContext || activeCycle;
      if (!currentActiveCycle) {
        setLoading(false);
        return;
      }
      setActiveCycle(currentActiveCycle);

      // Fetch year-end evaluation data (always fetch for both modes)
      try {
        const yearEndResult = await evaluationService.yearEndEvaluation.get(
          employeeId,
          currentActiveCycle.id
        );
        setYearEndEvaluation(yearEndResult.data);
        
        // Determine year-end evaluation state
        if (!yearEndResult.data) {
          setYearEndState('no_data');
        } else if (yearEndResult.data.status === 'pending' || yearEndResult.data.status === 'in_progress') {
          setYearEndState('manager_pending');
        } else if (yearEndResult.data.status === 'submitted' && !yearEndResult.data.released_at) {
          setYearEndState('hr_pending');
        } else if (yearEndResult.data.acknowledged_at) {
          setYearEndState('employee_accepted');
        } else if (yearEndResult.data.acknowledgment_comments && yearEndResult.data.released_at) {
          setYearEndState('employee_rejected');
        } else if (yearEndResult.data.released_at) {
          setYearEndState('hr_approved');
        } else {
          setYearEndState('no_data');
        }
      } catch {
        setYearEndEvaluation(null);
        setYearEndState('no_data');
      }

      // If year-end mode, we're done after fetching year-end data
      if (viewMode === 'year-end') {
        setLoading(false);
        return;
      }

      const quarter = parseInt(selectedQuarter);
      const currentTransition = transitions[quarter];
      
      
      if (isTransitionTab && currentTransition) {
        console.log('Fetching post-transition data (transition tab)');
        await fetchTransitionData(employeeId, currentActiveCycle.id, quarter, currentTransition);
        setLoading(false);
        return;
      }
      
      // If transition exists but we're in regular tab, fetch pre-transition data only
      if (currentTransition && !isTransitionTab) {
        console.log('Fetching pre-transition data (regular tab), transition ID:', currentTransition.id);
        await fetchPreTransitionData(employeeId, currentActiveCycle.id, quarter, currentTransition);
        return; // fetchPreTransitionData handles setLoading(false)
      }
            
      // Get self-review for selected quarter (no transition - full quarter)
      const selfReviewsResult = await evaluationService.selfReviews.get(
        employeeId, 
        currentActiveCycle.id, 
        quarter
      );
      // Filter out transition-specific reviews for regular view
      const selfReviewData = selfReviewsResult.data?.find((r: any) => 
        r.quarter === quarter && (!r.period_type || r.period_type === 'full_quarter')
      );
      setSelfReview(selfReviewData || null);

      // Determine evaluation state
      if (!selfReviewData || selfReviewData.status !== 'submitted') {
        setEvaluationState('no_self_eval');
        setManagerReview(null);
        setGoalRatings([]);
        setKraRatings([]);
        setLoading(false);
        return;
      }

      // Get KRAs for selected quarter (fetch before manager review check)
      const krasResult = await goalsService.kras.getByEmployee(
        employeeId, 
        currentActiveCycle.id, 
        'approved',
        quarter
      );
      const quarterKras = (krasResult.data || []).filter((kra: any) => kra.quarter === quarter);
      setKras(quarterKras);

      // Get KPIs for selected quarter
      const goalsResult = await goalsService.kpis.getByEmployee(
        employeeId, 
        currentActiveCycle.id, 
        'approved',
        quarter
      );
      const quarterKpis = (goalsResult.data || []).filter((kpi: any) => kpi.kra_id && kpi.quarter === quarter);

      // Get self ratings
      let selfRatings: any[] = [];
      if (selfReviewData?.id) {
        const selfProgressResult = await evaluationService.goalSelfRatings.get(selfReviewData.id);
        selfRatings = selfProgressResult.data || [];
      }

      // Get manager review for selected quarter
      const mgrReviewsResult = await evaluationService.managerReviews.get(
        employeeId, 
        currentActiveCycle.id, 
        quarter
      );
      const mgrReviewData = mgrReviewsResult.data?.find((r: any) => r.quarter === quarter);
      setManagerReview(mgrReviewData || null);

      // Always try to fetch calibrated rating if HR has published it
      // The API will only return data if status = 'PUBLISHED', so it's safe to always try
      let fetchedCalibratedRating: number | null = null;
      try {
        const calibratedResult = await evaluationService.normalization.getEmployeeRating(
          employeeId,
          quarter,
          currentActiveCycle.id
        );
        if (calibratedResult.data?.calibrated_rating) {
          fetchedCalibratedRating = calibratedResult.data.calibrated_rating;
          setCalibratedRating(fetchedCalibratedRating);
        } else {
          setCalibratedRating(null);
        }
      } catch (error) {
        // No calibrated rating found - this is normal if not published yet
        console.log('No calibrated rating found yet - this is normal if not published');
        setCalibratedRating(null);
      }

      // Get manager KPI feedback (only if HR approved or employee can see)
      let mgrFeedback: any[] = [];
      if (mgrReviewData && (mgrReviewData.hr_approved_at || mgrReviewData.status === 'submitted')) {
        const mgrFeedbackResult = await evaluationService.kpiManagerFeedback.getByReview(mgrReviewData.id);
        mgrFeedback = mgrFeedbackResult.data || [];
      }

      // Combine KPIs with ratings
      const combinedGoals: GoalRating[] = quarterKpis.map((goal: any) => {
        const selfRating = selfRatings.find((r: any) => r.goal_id === goal.id);
        const mgrFeedbackItem = mgrFeedback.find((r: any) => r.goal_id === goal.id);

        return {
          ...goal,
          self_rating: selfRating?.self_rating || null,
          manager_rating: calibratedRating ? (calibratedRating || null) : null,
          manager_comments: mgrReviewData?.hr_approved_at ? (mgrFeedbackItem?.comments || null) : null
        };
      });

      setGoalRatings(combinedGoals);

      // Calculate KRA ratings from KPI ratings
      const selfKPIRatings: Record<string, number | null> = {};
      const managerKPIRatings: Record<string, number | null> = {};
      
      combinedGoals.forEach((goal) => {
        if (goal.kra_id) {
          selfKPIRatings[goal.id] = goal.self_rating;
          managerKPIRatings[goal.id] = goal.manager_rating;
        }
      });

      // Calculate KRA ratings
      const calculatedSelfKRARatings = calculateAllKRARatings(
        quarterKras.map((kra: any) => ({ id: kra.id, weight: kra.weight })),
        combinedGoals.map((goal) => ({ id: goal.id, kra_id: goal.kra_id || '', weight: goal.weight })),
        selfKPIRatings
      );

      const calculatedManagerKRARatings = calculateAllKRARatings(
        quarterKras.map((kra: any) => ({ id: kra.id, weight: kra.weight })),
        combinedGoals.map((goal) => ({ id: goal.id, kra_id: goal.kra_id || '', weight: goal.weight })),
        managerKPIRatings
      );

      // Set KRA ratings
      // Use calibrated rating if available (published), otherwise use calculated rating
      const kraRatingsData: KRARating[] = quarterKras.map((kra: any) => ({
        id: kra.id,
        title: kra.title,
        weight: kra.weight,
        self_rating: calculatedSelfKRARatings[kra.id] || null,
        manager_rating: fetchedCalibratedRating !== null && fetchedCalibratedRating !== undefined
          ? fetchedCalibratedRating
          : mgrReviewData?.hr_approved_at 
            ? (calculatedManagerKRARatings[kra.id] || null) 
            : null,
        quarter: kra.quarter || null,
      }));

      setKraRatings(kraRatingsData);

      // Determine evaluation state after fetching all data
      // If calibrated rating exists (published by HR), consider it as HR approved
      if (!mgrReviewData) {
        setEvaluationState('manager_pending');
      } else if (mgrReviewData.employee_acknowledged_at) {
        setEvaluationState('employee_accepted');
      } else if (mgrReviewData.employee_rejected_at) {
        setEvaluationState('employee_rejected');
      } else if (fetchedCalibratedRating !== null && fetchedCalibratedRating !== undefined) {
        // HR has published the calibrated rating, so it's approved
        setEvaluationState('hr_approved');
      } else if (mgrReviewData.hr_approved_at) {
        setEvaluationState('hr_approved');
      } else {
        setEvaluationState('hr_pending');
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load rating data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, selectedQuarter, viewMode, activeCycleFromContext, activeCycle, currentEmployee, toast, isTransitionTab, transitions]);
  
  // Call fetchData when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Fetch transition-specific data (pre and post-transition separately)
  const fetchTransitionData = useCallback(async (
    employeeId: string,
    cycleId: string,
    quarter: number,
    transition: any
  ) => {
    try {
      // Fetch pre-transition self-review
      const preSelfReviewsResult = await evaluationService.selfReviews.get(
        employeeId,
        cycleId,
        quarter
      );
      const preSelfReview = preSelfReviewsResult.data?.find((r: any) => 
        r.quarter === quarter && r.period_type === 'pre_transition' && r.transition_id === transition.id
      );
      setPreTransitionSelfReview(preSelfReview || null);
      
      // Fetch post-transition self-review
      const postSelfReview = preSelfReviewsResult.data?.find((r: any) => 
        r.quarter === quarter && r.period_type === 'post_transition' && r.transition_id === transition.id
      );
      setPostTransitionSelfReview(postSelfReview || null);
      
      // Fetch pre-transition manager review
      const preMgrReviewsResult = await evaluationService.managerReviews.get(
        employeeId,
        cycleId,
        quarter
      );
      const preMgrReview = preMgrReviewsResult.data?.find((r: any) => 
        r.quarter === quarter && r.period_type === 'pre_transition' && r.transition_id === transition.id
      );
      setPreTransitionManagerReview(preMgrReview || null);
      
      // Fetch post-transition manager review
      const postMgrReview = preMgrReviewsResult.data?.find((r: any) => 
        r.quarter === quarter && r.period_type === 'post_transition' && r.transition_id === transition.id
      );
      setPostTransitionManagerReview(postMgrReview || null);
      
      // Fetch pre-transition KRAs and KPIs with period_type and transition_id filters
      const preKrasResult = await goalsService.kras.getByEmployee(
        employeeId,
        cycleId,
        'approved',
        quarter,
        'pre_transition',
        transition.id
      );
      const preKras = preKrasResult.data || [];
      
      const preKpisResult = await goalsService.kpis.getByEmployee(
        employeeId,
        cycleId,
        'approved',
        quarter,
        'pre_transition',
        transition.id
      );
      const preKpis = (preKpisResult.data || []).filter((kpi: any) => kpi.kra_id);
      
      // Fetch post-transition KRAs and KPIs with period_type and transition_id filters
      const postKrasResult = await goalsService.kras.getByEmployee(
        employeeId,
        cycleId,
        'approved',
        quarter,
        'post_transition',
        transition.id
      );
      const postKras = postKrasResult.data || [];
      
      const postKpisResult = await goalsService.kpis.getByEmployee(
        employeeId,
        cycleId,
        'approved',
        quarter,
        'post_transition',
        transition.id
      );
      const postKpis = (postKpisResult.data || []).filter((kpi: any) => kpi.kra_id);
      
      // Fetch pre-transition self ratings
      let preSelfRatings: any[] = [];
      if (preSelfReview?.id) {
        const preSelfRatingsResult = await evaluationService.goalSelfRatings.get(preSelfReview.id);
        preSelfRatings = preSelfRatingsResult.data || [];
      }
      
      // Fetch post-transition self ratings
      let postSelfRatings: any[] = [];
      if (postSelfReview?.id) {
        const postSelfRatingsResult = await evaluationService.goalSelfRatings.get(postSelfReview.id);
        postSelfRatings = postSelfRatingsResult.data || [];
      }
      
      // Fetch pre-transition manager feedback
      let preMgrFeedback: any[] = [];
      if (preMgrReview && (preMgrReview.hr_approved_at || preMgrReview.status === 'submitted')) {
        const preMgrFeedbackResult = await evaluationService.kpiManagerFeedback.getByReview(preMgrReview.id);
        preMgrFeedback = preMgrFeedbackResult.data || [];
      }
      
      // Fetch post-transition manager feedback
      let postMgrFeedback: any[] = [];
      if (postMgrReview && (postMgrReview.hr_approved_at || postMgrReview.status === 'submitted')) {
        const postMgrFeedbackResult = await evaluationService.kpiManagerFeedback.getByReview(postMgrReview.id);
        postMgrFeedback = postMgrFeedbackResult.data || [];
      }
      
      // Fetch pre-transition calibrated rating
      let preCalibratedRating: number | null = null;
      try {
        const preCalibratedResult = await evaluationService.normalization.getEmployeeRating(
          employeeId,
          quarter,
          cycleId,
          'pre_transition',
          transition.id
        );
        preCalibratedRating = preCalibratedResult.data?.calibrated_rating || null;
      } catch {
        // No pre-transition calibrated rating
      }
      setPreTransitionCalibratedRating(preCalibratedRating);
      
      // Fetch post-transition calibrated rating
      let postCalibratedRating: number | null = null;
      try {
        const postCalibratedResult = await evaluationService.normalization.getEmployeeRating(
          employeeId,
          quarter,
          cycleId,
          'post_transition',
          transition.id
        );
        postCalibratedRating = postCalibratedResult.data?.calibrated_rating || null;
      } catch {
        // No post-transition calibrated rating
      }
      setPostTransitionCalibratedRating(postCalibratedRating);
      
      // Combine pre-transition KPIs with ratings
      const preCombinedGoals: GoalRating[] = preKpis.map((goal: any) => {
        const selfRating = preSelfRatings.find((r: any) => r.goal_id === goal.id);
        const mgrFeedbackItem = preMgrFeedback.find((r: any) => r.goal_id === goal.id);
        
        return {
          ...goal,
          self_rating: selfRating?.self_rating || null,
          manager_rating: preCalibratedRating || (preMgrReview?.hr_approved_at ? (mgrFeedbackItem?.rating || null) : null),
          manager_comments: preMgrReview?.hr_approved_at ? (mgrFeedbackItem?.comments || null) : null
        };
      });
      setPreTransitionGoalRatings(preCombinedGoals);
      
      // Combine post-transition KPIs with ratings
      const postCombinedGoals: GoalRating[] = postKpis.map((goal: any) => {
        const selfRating = postSelfRatings.find((r: any) => r.goal_id === goal.id);
        const mgrFeedbackItem = postMgrFeedback.find((r: any) => r.goal_id === goal.id);
        
        return {
          ...goal,
          self_rating: selfRating?.self_rating || null,
          manager_rating: postCalibratedRating || (postMgrReview?.hr_approved_at ? (mgrFeedbackItem?.rating || null) : null),
          manager_comments: postMgrReview?.hr_approved_at ? (mgrFeedbackItem?.comments || null) : null
        };
      });
      setPostTransitionGoalRatings(postCombinedGoals);
      
      // Calculate pre-transition KRA ratings
      const preSelfKPIRatings: Record<string, number | null> = {};
      const preManagerKPIRatings: Record<string, number | null> = {};
      preCombinedGoals.forEach((goal) => {
        if (goal.kra_id) {
          preSelfKPIRatings[goal.id] = goal.self_rating;
          preManagerKPIRatings[goal.id] = goal.manager_rating;
        }
      });
      
      const preCalculatedSelfKRARatings = calculateAllKRARatings(
        preKras.map((kra: any) => ({ id: kra.id, weight: kra.weight })),
        preCombinedGoals.map((goal) => ({ id: goal.id, kra_id: goal.kra_id || '', weight: goal.weight })),
        preSelfKPIRatings
      );
      
      const preCalculatedManagerKRARatings = calculateAllKRARatings(
        preKras.map((kra: any) => ({ id: kra.id, weight: kra.weight })),
        preCombinedGoals.map((goal) => ({ id: goal.id, kra_id: goal.kra_id || '', weight: goal.weight })),
        preManagerKPIRatings
      );
      
      const preKraRatingsData: KRARating[] = preKras.map((kra: any) => ({
        id: kra.id,
        title: kra.title,
        weight: kra.weight,
        self_rating: preCalculatedSelfKRARatings[kra.id] || null,
        manager_rating: preCalibratedRating !== null
          ? preCalibratedRating
          : preMgrReview?.hr_approved_at
            ? (preCalculatedManagerKRARatings[kra.id] || null)
            : null,
        quarter: kra.quarter || null,
      }));
      setPreTransitionKraRatings(preKraRatingsData);
      
      // Calculate post-transition KRA ratings
      const postSelfKPIRatings: Record<string, number | null> = {};
      const postManagerKPIRatings: Record<string, number | null> = {};
      postCombinedGoals.forEach((goal) => {
        if (goal.kra_id) {
          postSelfKPIRatings[goal.id] = goal.self_rating;
          postManagerKPIRatings[goal.id] = goal.manager_rating;
        }
      });
      
      const postCalculatedSelfKRARatings = calculateAllKRARatings(
        postKras.map((kra: any) => ({ id: kra.id, weight: kra.weight })),
        postCombinedGoals.map((goal) => ({ id: goal.id, kra_id: goal.kra_id || '', weight: goal.weight })),
        postSelfKPIRatings
      );
      
      const postCalculatedManagerKRARatings = calculateAllKRARatings(
        postKras.map((kra: any) => ({ id: kra.id, weight: kra.weight })),
        postCombinedGoals.map((goal) => ({ id: goal.id, kra_id: goal.kra_id || '', weight: goal.weight })),
        postManagerKPIRatings
      );
      
      const postKraRatingsData: KRARating[] = postKras.map((kra: any) => ({
        id: kra.id,
        title: kra.title,
        weight: kra.weight,
        self_rating: postCalculatedSelfKRARatings[kra.id] || null,
        manager_rating: postCalibratedRating !== null
          ? postCalibratedRating
          : postMgrReview?.hr_approved_at
            ? (postCalculatedManagerKRARatings[kra.id] || null)
            : null,
        quarter: kra.quarter || null,
      }));
      setPostTransitionKraRatings(postKraRatingsData);
      
      // Determine evaluation state for transition tab (post-transition only)
      // Since we're in the transition tab, we only care about post-transition state
      const postApproved = postMgrReview?.hr_approved_at || postCalibratedRating !== null;
      
      if (postApproved) {
        // Post-transition approved - check if employee has acknowledged
        if (postMgrReview?.employee_acknowledged_at) {
          setEvaluationState('employee_accepted');
        } else if (postMgrReview?.employee_rejected_at) {
          setEvaluationState('employee_rejected');
        } else {
          setEvaluationState('hr_approved');
        }
      } else if (postMgrReview) {
        setEvaluationState('hr_pending');
      } else {
        setEvaluationState('manager_pending');
      }
    } catch (error: any) {
      console.error('Error fetching transition data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load transition rating data',
        variant: 'destructive',
      });
    }
  }, [toast]);
  
  // Fetch pre-transition data only (for regular quarter tab when transition exists)
  const fetchPreTransitionData = useCallback(async (
    employeeId: string,
    cycleId: string,
    quarter: number,
    transition: any
  ) => {
    try {
      setLoading(true);
      
      // Fetch pre-transition self-review
      const preSelfReviewsResult = await evaluationService.selfReviews.get(
        employeeId,
        cycleId,
        quarter
      );
      const preSelfReview = preSelfReviewsResult.data?.find((r: any) => 
        r.quarter === quarter && r.period_type === 'pre_transition' && r.transition_id === transition.id
      );
      setSelfReview(preSelfReview || null);
      
      // Fetch pre-transition manager review
      const preMgrReviewsResult = await evaluationService.managerReviews.get(
        employeeId,
        cycleId,
        quarter
      );
      const preMgrReview = preMgrReviewsResult.data?.find((r: any) => 
        r.quarter === quarter && r.period_type === 'pre_transition' && r.transition_id === transition.id
      );
      setManagerReview(preMgrReview || null);
      

      
      let preKras: any[] = [];
      let preKpis: any[] = [];
      
      try {
        // Pre-transition KRAs are set to 'locked' status when transition is created
        // So we need to fetch without status filter or include 'locked' status
        // Fetch without status filter to get both 'approved' and 'locked' KRAs
        const preKrasResult = await goalsService.kras.getByEmployee(
          employeeId,
          cycleId,
          undefined, // No status filter - we want both 'approved' and 'locked' for pre-transition
          quarter,
          'pre_transition',
          transition.id
        );
        console.log('Pre-transition KRAs API response (full):', JSON.stringify(preKrasResult, null, 2));
        console.log('Pre-transition KRAs API response type:', typeof preKrasResult);
        console.log('Pre-transition KRAs API response.data:', preKrasResult.data);
        preKras = (preKrasResult.data || []).filter((k: any) => 
          k.status === 'approved' || k.status === 'locked'
        );
        console.log('Pre-transition KRAs fetched (after filtering by status):', preKras.length, preKras);
      } catch (error: any) {
        console.error('Error fetching pre-transition KRAs:', error);
        toast({
          title: 'Error',
          description: `Failed to fetch pre-transition KRAs: ${error.message}`,
          variant: 'destructive',
        });
      }
      
      setKras(preKras);
      
      try {
        // Pre-transition KPIs are set to 'locked' status when transition is created
        // So we need to fetch without status filter or include 'locked' status
        const preKpisResult = await goalsService.kpis.getByEmployee(
          employeeId,
          cycleId,
          undefined, // No status filter - we want both 'approved' and 'locked' for pre-transition
          quarter,
          'pre_transition',
          transition.id
        );
        console.log('Pre-transition KPIs API response (full):', JSON.stringify(preKpisResult, null, 2));
        console.log('Pre-transition KPIs API response.data:', preKpisResult.data);
        preKpis = (preKpisResult.data || []).filter((kpi: any) => 
          kpi.kra_id && (kpi.status === 'approved' || kpi.status === 'locked')
        );
        console.log('Pre-transition KPIs fetched (after filtering):', preKpis.length, preKpis);
      } catch (error: any) {
        console.error('Error fetching pre-transition KPIs:', error);
        toast({
          title: 'Error',
          description: `Failed to fetch pre-transition KPIs: ${error.message}`,
          variant: 'destructive',
        });
      }
      
      // Fetch pre-transition self ratings
      let preSelfRatings: any[] = [];
      if (preSelfReview?.id) {
        const preSelfRatingsResult = await evaluationService.goalSelfRatings.get(preSelfReview.id);
        preSelfRatings = preSelfRatingsResult.data || [];
      }
      
      // Fetch pre-transition manager feedback
      let preMgrFeedback: any[] = [];
      if (preMgrReview && (preMgrReview.hr_approved_at || preMgrReview.status === 'submitted')) {
        const preMgrFeedbackResult = await evaluationService.kpiManagerFeedback.getByReview(preMgrReview.id);
        preMgrFeedback = preMgrFeedbackResult.data || [];
      }
      
      // Fetch pre-transition calibrated rating
      let preCalibratedRating: number | null = null;
      try {
        const preCalibratedResult = await evaluationService.normalization.getEmployeeRating(
          employeeId,
          quarter,
          cycleId,
          'pre_transition',
          transition.id
        );
        preCalibratedRating = preCalibratedResult.data?.calibrated_rating || null;
      } catch {
        // No pre-transition calibrated rating
      }
      setCalibratedRating(preCalibratedRating);
      
      // Combine pre-transition KPIs with ratings
      console.log('Before combining goals - preKpis:', preKpis.length, 'preSelfRatings:', preSelfRatings.length, 'preMgrFeedback:', preMgrFeedback.length);
      
      // If we have KRAs but no KPIs, that's a data issue - log it
      if (preKras.length > 0 && preKpis.length === 0) {
        console.warn('WARNING: Found pre-transition KRAs but no KPIs! This might indicate a data issue.');
        console.warn('KRAs:', preKras.map(k => ({ id: k.id, title: k.title })));
      }
      
      // If we have no KRAs at all, log a warning
      if (preKras.length === 0) {
        console.warn('WARNING: No pre-transition KRAs found in database!');
        console.warn('Expected filters:', {
          employee_id: employeeId,
          cycle_id: cycleId,
          quarter: quarter,
          period_type: 'pre_transition',
          transition_id: transition.id,
          status: 'approved'
        });
      }
      
      const preCombinedGoals: GoalRating[] = preKpis.map((goal: any) => {
        const selfRating = preSelfRatings.find((r: any) => r.goal_id === goal.id);
        const mgrFeedbackItem = preMgrFeedback.find((r: any) => r.goal_id === goal.id);
        
        return {
          ...goal,
          self_rating: selfRating?.self_rating || null,
          manager_rating: preCalibratedRating || (preMgrReview?.hr_approved_at ? (mgrFeedbackItem?.rating || null) : null),
          manager_comments: preMgrReview?.hr_approved_at ? (mgrFeedbackItem?.comments || null) : null
        };
      });
      console.log('Pre-combined goals:', preCombinedGoals.length);
      setGoalRatings(preCombinedGoals);
      
      // Calculate pre-transition KRA ratings
      const preSelfKPIRatings: Record<string, number | null> = {};
      const preManagerKPIRatings: Record<string, number | null> = {};
      preCombinedGoals.forEach((goal) => {
        if (goal.kra_id) {
          preSelfKPIRatings[goal.id] = goal.self_rating;
          preManagerKPIRatings[goal.id] = goal.manager_rating;
        }
      });
      
      const preCalculatedSelfKRARatings = calculateAllKRARatings(
        preKras.map((kra: any) => ({ id: kra.id, weight: kra.weight })),
        preCombinedGoals.map((goal) => ({ id: goal.id, kra_id: goal.kra_id || '', weight: goal.weight })),
        preSelfKPIRatings
      );
      
      const preCalculatedManagerKRARatings = calculateAllKRARatings(
        preKras.map((kra: any) => ({ id: kra.id, weight: kra.weight })),
        preCombinedGoals.map((goal) => ({ id: goal.id, kra_id: goal.kra_id || '', weight: goal.weight })),
        preManagerKPIRatings
      );
      
      const preKraRatingsData: KRARating[] = preKras.map((kra: any) => ({
        id: kra.id,
        title: kra.title,
        weight: kra.weight,
        self_rating: preCalculatedSelfKRARatings[kra.id] || null,
        manager_rating: preCalibratedRating !== null
          ? preCalibratedRating
          : preMgrReview?.hr_approved_at
            ? (preCalculatedManagerKRARatings[kra.id] || null)
            : null,
        quarter: kra.quarter || null,
      }));
      console.log('Pre-transition KRA ratings data calculated:', preKraRatingsData.length, preKraRatingsData);
      console.log('Pre-transition KRAs count:', preKras.length);
      console.log('Pre-transition KPIs count:', preKpis.length);
      console.log('Pre-transition calculated self KRA ratings:', preCalculatedSelfKRARatings);
      setKraRatings(preKraRatingsData);
      
      // Determine evaluation state for pre-transition
      if (!preMgrReview) {
        setEvaluationState('manager_pending');
      } else if (preMgrReview.employee_acknowledged_at) {
        setEvaluationState('employee_accepted');
      } else if (preMgrReview.employee_rejected_at) {
        setEvaluationState('employee_rejected');
      } else if (preCalibratedRating !== null || preMgrReview.hr_approved_at) {
        setEvaluationState('hr_approved');
      } else {
        setEvaluationState('hr_pending');
      }
      
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching pre-transition data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load pre-transition rating data',
        variant: 'destructive',
      });
      setLoading(false);
    }
  }, [toast]);

  console.log(calibratedRating);

  const handleAcceptRating = useCallback(async () => {
    if (!managerReview) return;

    setSaving(true);
    try {
      await evaluationService.employeeRating.acceptRating(managerReview.id);
      toast({ title: 'Rating accepted successfully' });
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept rating',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [managerReview, toast, fetchData]);

  const handleRejectRating = useCallback(async () => {
    if (!rejectionReason.trim() || !activeCycle) return;

    setSaving(true);
    try {
      if (isYearEndRejection && yearEndEvaluation?.id) {
        // Year-end rejection
        await evaluationService.yearEndEmployeeRating.rejectRating(
          yearEndEvaluation.id,
          rejectionReason.trim(),
          activeCycle.id
        );
        toast({ title: 'Year-end rating rejection submitted' });
      } else if (managerReview) {
        // Quarterly rejection
        await evaluationService.employeeRating.rejectRating(
          managerReview.id,
          rejectionReason.trim(),
          activeCycle.id,
          parseInt(selectedQuarter)
        );
        toast({ title: 'Rating rejection submitted' });
      }
      setShowRejectionDialog(false);
      setRejectionReason('');
      setIsYearEndRejection(false);
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit rejection',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [managerReview, yearEndEvaluation, rejectionReason, activeCycle, selectedQuarter, isYearEndRejection, toast, fetchData]);

  const handleAcceptYearEndRating = useCallback(async () => {
    if (!yearEndEvaluation?.id) return;

    setSaving(true);
    try {
      await evaluationService.yearEndEmployeeRating.acceptRating(yearEndEvaluation.id);
      toast({ title: 'Year-end rating accepted successfully' });
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept year-end rating',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [yearEndEvaluation, toast, fetchData]);

  const handleQuarterChange = useCallback((quarter: string) => {
    setSelectedQuarter(quarter);
    setViewMode('quarterly');
    setSearchParams({ quarter });
  }, [setSearchParams]);

  const handleViewModeChange = useCallback((mode: 'quarterly' | 'year-end', quarterOverride?: string) => {
    setViewMode(mode);
    if (mode === 'year-end') {
      setSearchParams({ quarter: 'year-end' });
    } else {
      // Use quarterOverride if provided, otherwise use current selectedQuarter
      setSearchParams({ quarter: quarterOverride || selectedQuarter });
    }
  }, [selectedQuarter, setSearchParams]);

  const getRatingLabel = useCallback((value: number | null) => {
    if (!value) return '-';
    const lookupValue = Math.floor(value);
    const scale = ratingScales.find(s => s.value === lookupValue);
      return scale ? `${value} - ${scale.name}` : value.toString();
  }, [ratingScales]);

  const activeTab = useMemo(() => {
    if (viewMode === 'year-end') return 'year-end';
    if (isTransitionTab) return `q${selectedQuarter}-transition`;
    return `q${selectedQuarter}`;
  }, [viewMode, selectedQuarter, isTransitionTab]);

  const handleTabChange = useCallback((tab: string) => {
    if (tab === 'year-end') {
      handleViewModeChange('year-end');
      setIsTransitionTab(false);
      setSearchParams({ quarter: 'year-end' });
    } else if (tab.endsWith('-transition')) {
      const quarter = tab.replace('q', '').replace('-transition', '');
      setSelectedQuarter(quarter);
      setIsTransitionTab(true);
      handleViewModeChange('quarterly', quarter);
      setSearchParams({ quarter, transition: 'true' });
    } else {
      const quarter = tab.replace('q', '');
      setSelectedQuarter(quarter);
      setIsTransitionTab(false);
      handleViewModeChange('quarterly', quarter);
      setSearchParams({ quarter });
    }
  }, [handleViewModeChange, setSearchParams]);

  const formatJoinDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Render Year-End Evaluation Content
  const renderYearEndContent = () => {
    if (!yearEndEvaluation) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No year-end evaluation available</h3>
            <p className="text-muted-foreground text-center">
              Your year-end evaluation has not been completed yet.
            </p>
          </CardContent>
        </Card>
      );
    }

    // Manager pending
    if (yearEndState === 'manager_pending' || yearEndState === 'no_data') {
      return (
        <>
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Year-end evaluation is pending. Your manager has not completed your year-end evaluation yet.
            </AlertDescription>
          </Alert>
          
          {/* Show quarterly ratings summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Quarterly Ratings Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 ">
                {[
                  { label: 'Q1', rating: yearEndEvaluation.q1_rating },
                  { label: 'Q2', rating: yearEndEvaluation.q2_rating },
                  { label: 'Q3', rating: yearEndEvaluation.q3_rating },
                  { label: 'Q4', rating: yearEndEvaluation.q4_rating },
                ].map((q) => (
                  <div key={q.label} className="p-3 rounded-lg bg-muted/50 text-center ">
                    <div className="text-xs text-muted-foreground mb-1">{q.label}</div>
                    <div className="font-semibold">
                      {q.rating !== null && q.rating !== undefined ? formatRating(q.rating) : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      );
    }

    // HR pending
    if (yearEndState === 'hr_pending') {
      return (
        <>
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Manager has submitted your year-end evaluation. HR review is in progress.
            </AlertDescription>
          </Alert>

          {/* Show quarterly ratings summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Quarterly Ratings Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Q1', rating: yearEndEvaluation.q1_rating },
                  { label: 'Q2', rating: yearEndEvaluation.q2_rating },
                  { label: 'Q3', rating: yearEndEvaluation.q3_rating },
                  { label: 'Q4', rating: yearEndEvaluation.q4_rating },
                ].map((q) => (
                  <div key={q.label} className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{q.label}</div>
                    <div className="font-semibold">
                      {q.rating !== null && q.rating !== undefined ? formatRating(q.rating) : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      );
    }

    // HR approved or employee accepted/rejected - show full details
    return (
      <>
        {/* Employee Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Employee Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Joining Date</Label>
                <p className="font-medium mt-1">{formatJoinDate(employee?.date_of_joining)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Quarters Evaluated</Label>
                <p className="font-medium mt-1">{yearEndEvaluation.completed_quarters || 0} of 4 Quarters</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quarterly Ratings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Quarterly Manager Ratings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Q1', rating: yearEndEvaluation.q1_rating },
                { label: 'Q2', rating: yearEndEvaluation.q2_rating },
                { label: 'Q3', rating: yearEndEvaluation.q3_rating },
                { label: 'Q4', rating: yearEndEvaluation.q4_rating },
              ].map((q) => (
                <div key={q.label} className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-sm text-muted-foreground mb-1">{q.label}</div>
                  <div className="text-xl font-bold">
                    {q.rating !== null && q.rating !== undefined ? formatRating(q.rating) : '-'}
                  </div>
                </div>
              ))}
            </div>
            
            <Separator className="my-4" />
            
            {/* Overall Year-End Rating */}
            <div className="text-center p-6 rounded-lg bg-primary/5 border-2 border-primary">
              <div className="text-sm text-muted-foreground mb-2">Year-End Overall Rating</div>
              <div className="text-4xl font-bold text-primary mb-2">
                {yearEndEvaluation.overall_rating 
                  ? formatRating(yearEndEvaluation.overall_rating)
                  : yearEndEvaluation.calculated_overall_rating
                    ? formatRating(yearEndEvaluation.calculated_overall_rating)
                    : '-'}
              </div>
              {yearEndEvaluation.calculated_overall_rating && !yearEndEvaluation.overall_rating && (
                <div className="text-xs text-muted-foreground">
                  (Auto-calculated average of quarterly ratings)
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Manager's Overall Feedback */}
        {yearEndEvaluation.overall_comments && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Manager's Overall Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{yearEndEvaluation.overall_comments}</p>
            </CardContent>
          </Card>
        )}

        {/* Development Recommendations */}
        {yearEndEvaluation.development_recommendations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Development Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{yearEndEvaluation.development_recommendations}</p>
            </CardContent>
          </Card>
        )}

        {/* Accept/Reject Actions */}
        {yearEndState === 'hr_approved' && (
          <Card>
            <CardHeader>
              <CardTitle>Accept or Reject Your Year-End Rating</CardTitle>
              <CardDescription>
                Please review your year-end rating and either accept or reject it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button 
                  onClick={handleAcceptYearEndRating} 
                  disabled={saving}
                  className="flex-1"
                  variant="default"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Accept
                </Button>
                <Button 
                  onClick={() => {
                    setIsYearEndRejection(true);
                    setShowRejectionConfirmation(true);
                  }} 
                  disabled={saving}
                  className="flex-1"
                  variant="destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!employeeId && !isHR) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your employee profile is not set up. Please contact HR.
          </AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  // if (!employeeId && isHR) {
  //   return (
  //     <MainLayout>
  //       <div className="space-y-6">
  //         <div>
  //           <h1 className="text-3xl font-bold tracking-tight">My Rating</h1>
  //           <p className="text-muted-foreground">View your performance rating</p>
  //         </div>
  //         <Alert>
  //           <AlertCircle className="h-4 w-4" />
  //           <AlertDescription>
  //             As an HR user, you can view employee ratings from the Reports page.
  //           </AlertDescription>
  //         </Alert>
  //       </div>
  //     </MainLayout>
  //   );
  // }

  // Render transition content (post-transition ratings only)
  const renderTransitionContent = (quarter: number, transition: any) => {
    // Calculate post-transition overall rating
    const postOverallRating = postTransitionCalibratedRating !== null
      ? postTransitionCalibratedRating
      : (postTransitionManagerReview?.calculated_overall_rating || null);
    
    const postApproved = postTransitionManagerReview?.hr_approved_at || postTransitionCalibratedRating !== null;
    
    return (
      <>
        {/* Transition Info Card */}
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Mid-Quarter Transition Detected
            </CardTitle>
            <CardDescription>
              Transition Date: {new Date(transition.transition_date).toLocaleDateString()} • Type: {transition.transition_type}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Post-Transition Period</span>
                {transition.post_period_start_date && transition.post_period_end_date && (
                  <div className="font-medium">
                    {formatPeriodDateRange(transition.post_period_start_date, transition.post_period_end_date)}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Post-Transition Period Ratings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant={getPeriodBadgeVariant('post_transition')}>
                {getPeriodLabel('post_transition')}
              </Badge>
              Post-Transition Period Ratings
            </CardTitle>
            <CardDescription>
              {transition.post_period_start_date && transition.post_period_end_date && (
                formatPeriodDateRange(transition.post_period_start_date, transition.post_period_end_date)
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Post-Transition Overall Rating */}
            {postOverallRating !== null && (
              <div className="p-4 rounded-lg bg-muted/30 border">
                <div className="text-sm text-muted-foreground mb-1">Post-Transition Overall Rating</div>
                <div className="text-2xl font-bold">{formatRating(postOverallRating)}</div>
              </div>
            )}
            
            {/* Post-Transition KRAs */}
            {postTransitionKraRatings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No post-transition KRAs found</p>
              </div>
            ) : (
              postTransitionKraRatings.map((kra) => {
                const kraKPIs = postTransitionGoalRatings.filter((kpi) => kpi.kra_id === kra.id);
                const isExpanded = expandedKRAs[`post-${kra.id}`] || false;
                
                return (
                  <Card key={kra.id} className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 mt-1"
                          onClick={() => setExpandedKRAs(prev => ({ ...prev, [`post-${kra.id}`]: !prev[`post-${kra.id}`] }))}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-primary/10">KRA</Badge>
                            <span className="text-sm font-medium text-primary">Weight: {kra.weight}%</span>
                            <span className="text-sm text-muted-foreground">({kraKPIs.length} KPIs)</span>
                          </div>
                          <CardTitle className="text-lg">{kra.title}</CardTitle>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground mb-1">KRA Rating</div>
                          <div className="text-sm font-medium">Self: {getRatingLabel(kra.self_rating)}</div>
                          {kra.manager_rating && (
                            <div className="text-sm font-medium mt-1">Manager: {getRatingLabel(kra.manager_rating)}</div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    {isExpanded && (
                      <CardContent className="space-y-3">
                        {kraKPIs.map((kpi) => (
                          <div key={kpi.id} className="p-4 rounded-lg border bg-card">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary">KPI</Badge>
                              <span className="text-sm text-muted-foreground">Weight: {kpi.weight}%</span>
                            </div>
                            <h5 className="font-medium mb-3">{kpi.title}</h5>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="p-3 rounded bg-muted/30">
                                <div className="text-xs text-muted-foreground mb-1">Self Rating</div>
                                <div className="font-medium">{getRatingLabel(kpi.self_rating)}</div>
                              </div>
                              {kpi.manager_rating && (
                                <div className="p-3 rounded bg-primary/5">
                                  <div className="text-xs text-muted-foreground mb-1">Manager Rating</div>
                                  <div className="font-medium">{getRatingLabel(kpi.manager_rating)}</div>
                                </div>
                              )}
                            </div>
                            {kpi.manager_comments && (
                              <div className="mt-3 p-3 rounded bg-muted/20">
                                <div className="text-xs text-muted-foreground mb-1">Manager Feedback</div>
                                <p className="text-sm">{kpi.manager_comments}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>
        
        {/* Manager Feedback */}
        {postTransitionManagerReview?.overall_comments && (
          <Card>
            <CardHeader>
              <CardTitle>Overall Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{postTransitionManagerReview.overall_comments}</p>
            </CardContent>
          </Card>
        )}

        {postTransitionManagerReview?.guidance && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Development Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>{postTransitionManagerReview.guidance}</p>
            </CardContent>
          </Card>
        )}
        
        {/* Accept/Reject Actions (if post-transition is HR approved) */}
        {postApproved && evaluationState === 'hr_approved' && (
          <Card>
            <CardHeader>
              <CardTitle>Accept or Reject Your Rating</CardTitle>
              <CardDescription>
                Please review your post-transition rating and either accept or reject it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button 
                  onClick={handleAcceptRating} 
                  disabled={saving}
                  className="flex-1"
                  variant="default"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Accept
                </Button>
                <Button 
                  onClick={() => {
                    setIsYearEndRejection(false);
                    setShowRejectionConfirmation(true);
                  }} 
                  disabled={saving}
                  className="flex-1"
                  variant="destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </>
    );
  };

  // Create single unified tab layout
  const renderTabs = (quarterContent: React.ReactNode) => {
    // Count total tabs: 4 quarters + transition tabs (if any) + year-end
    const quartersWithTransitions = [1, 2, 3, 4].filter(q => transitions[q]);
    const totalTabs = 4 + quartersWithTransitions.length + 1;
    
    // Build tabs array
    const tabs: Array<{ value: string; label: string; isTransition?: boolean }> = [];
    [1, 2, 3, 4].forEach(quarter => {
      tabs.push({ value: `q${quarter}`, label: `Q${quarter}` });
      if (transitions[quarter]) {
        tabs.push({ value: `q${quarter}-transition`, label: 'Transition', isTransition: true });
      }
    });
    tabs.push({ value: 'year-end', label: 'Year-End' });
    
    return (
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full " style={{ gridTemplateColumns: `repeat(${totalTabs}, 1fr)` }}>
          {tabs.map(tab => (
            <TabsTrigger 
              key={tab.value} 
              value={tab.value}
              className={tab.value === 'year-end' ? 'flex items-center gap-1' : ''}
            >
              {tab.value === 'year-end' && <Calendar className="h-4 w-4" />}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {[1, 2, 3, 4].map(quarter => (
          <TabsContent key={quarter} value={`q${quarter}`} className="space-y-4 ">
            {quarterContent}
          </TabsContent>
        ))}
        
        {[1, 2, 3, 4].map(quarter => {
          if (!transitions[quarter]) return null;
          return (
            <TabsContent key={`${quarter}-transition`} value={`q${quarter}-transition`} className="space-y-4">
              {renderTransitionContent(quarter, transitions[quarter])}
            </TabsContent>
          );
        })}
        
        <TabsContent value="year-end" className="space-y-4">
          {renderYearEndContent()}
        </TabsContent>
      </Tabs>
    );
  };

  // Case 2: No self-evaluation submitted for quarterly (or year-end mode)
  if (viewMode === 'year-end' || evaluationState === 'no_self_eval') {
    return (
      <MainLayout>
        <div className="space-y-6 max-w-4xl">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Rating</h1>
            <p className="text-muted-foreground">View your performance rating</p>
          </div>
          
          {activeCycle && renderTabs(
            viewMode === 'year-end' ? null : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Star className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No rating available</h3>
                  <p className="text-muted-foreground">
                    Your performance rating has not been released yet.
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </MainLayout>
    );
  }

  // Case 1: Manager review pending
  if (evaluationState === 'manager_pending') {
    return (
      <MainLayout>
        <div className="space-y-6 max-w-4xl ">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Rating</h1>
            <p className="text-muted-foreground">View your performance rating</p>
          </div>
          
          {activeCycle && renderTabs(
            <>
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  Manager review is under progress
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Your Self-Evaluation
                  </CardTitle>
                  <CardDescription>Q{selectedQuarter} Self-Review</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {kraRatings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No KRAs found for Q{selectedQuarter}</p>
                    </div>
                  ) : (
                    kraRatings.map((kra) => {
                      const kraKPIs = goalRatings.filter((kpi) => kpi.kra_id === kra.id);
                      const isExpanded = expandedKRAs[kra.id] || false;
                      
                      return (
                        <Card key={kra.id} className="border-l-4 border-l-card-border">
                          <CardHeader className="pb-3">
                            <div className="flex items-start gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 mt-1"
                                onClick={() => setExpandedKRAs(prev => ({ ...prev, [kra.id]: !prev[kra.id] }))}
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4 text-[hsl(var(--card-arrow))]" /> : <ChevronRight className="h-4 w-4 text-[hsl(var(--card-arrow))]" />}
                              </Button>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="bg-primary/10">KRA</Badge>
                                  <span className="text-sm font-medium text-primary">Weight: {kra.weight}%</span>
                                  <span className="text-sm text-muted-foreground">({kraKPIs.length} KPIs)</span>
                                </div>
                                <CardTitle className="text-lg">{kra.title}</CardTitle>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Calculator className="h-3 w-3" />
                                  KRA Rating
                                </div>
                                <div className="text-xl font-bold text-primary">
                                  {getRatingLabel(kra.self_rating)}
                                </div>
                              </div>
                            </div>
                          </CardHeader>

                          {isExpanded && (
                            <CardContent className="space-y-4">
                              {/* KPIs under this KRA */}
                              {kraKPIs.length > 0 && (
                                <div className="space-y-3">
                                  {kraKPIs.map((kpi) => (
                                    <div key={kpi.id} className="p-4 rounded-lg border bg-card">
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="secondary">KPI</Badge>
                                            <span className="text-sm text-muted-foreground">Weight: {kpi.weight}%</span>
                                          </div>
                                          <h5 className="font-medium">{kpi.title}</h5>
                                        </div>
                                      </div>
                                      
                                      <div className="mt-3">
                                        <div className="p-3 rounded bg-muted/30">
                                          <div className="text-xs text-muted-foreground mb-1">Your Self Rating</div>
                                          <div className="font-medium">{getRatingLabel(kpi.self_rating)}</div>
                                        </div>
                                      </div>                                      
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          )}
                        </Card>
                      );
                    })
                  )}
                  
                  {selfReview?.overall_comments && (
                    <div className="mt-4 p-4 rounded-lg bg-muted/20">
                      <div className="text-sm font-medium mb-2">Overall Comments</div>
                      <p className="text-sm text-muted-foreground">{selfReview.overall_comments}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </MainLayout>
    );
  }

  // renderTransitionContent is already defined above renderTabs - duplicate removed

  const renderQuarterlyContent = () => {
    const quarter = parseInt(selectedQuarter);
    const currentTransition = transitions[quarter];
    const isPreTransitionView = currentTransition && !isTransitionTab;
    
    return (
      <>
        {/* Show transition info if viewing pre-transition period */}
        {isPreTransitionView && (
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Pre-Transition Period
              </CardTitle>
              <CardDescription>
                Transition Date: {new Date(currentTransition.transition_date).toLocaleDateString()} • Type: {currentTransition.transition_type}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <span className="text-muted-foreground">Period: </span>
                {currentTransition.pre_period_start_date && currentTransition.pre_period_end_date && (
                  <span className="font-medium">
                    {formatPeriodDateRange(currentTransition.pre_period_start_date, currentTransition.pre_period_end_date)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {evaluationState === 'hr_pending' && calibratedRating === null && (
          <>
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Manager review submitted. HR review is under progress.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Your Self-Evaluation
                </CardTitle>
                <CardDescription>
                  Your self-evaluation ratings for Q{selectedQuarter}
                  {isPreTransitionView && ' (Pre-Transition Period)'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(() => {
                  console.log('Rendering quarterly content - kraRatings:', kraRatings.length, kraRatings);
                  console.log('Rendering quarterly content - kras state:', kras.length, kras);
                  console.log('Rendering quarterly content - isPreTransitionView:', isPreTransitionView);
                  console.log('Rendering quarterly content - currentTransition:', currentTransition);
                  return null;
                })()}
                {(kraRatings.length === 0 && kras.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No KRAs found for Q{selectedQuarter}</p>
                    {isPreTransitionView && currentTransition && (
                      <div className="text-xs mt-2 text-orange-600">
                        <p>Pre-transition period detected</p>
                        <p>Transition ID: {currentTransition.id}</p>
                        <p>Please check if KRAs exist with:</p>
                        <ul className="list-disc list-inside mt-1">
                          <li>period_type = 'pre_transition'</li>
                          <li>transition_id = '{currentTransition.id}'</li>
                          <li>quarter = {quarter}</li>
                          <li>employee_id = {employeeId}</li>
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  (kraRatings.length > 0 ? kraRatings : kras.map((kra: any) => ({
                    id: kra.id,
                    title: kra.title,
                    weight: kra.weight,
                    self_rating: null,
                    manager_rating: null,
                    quarter: kra.quarter || null,
                  }))).map((kra) => {
                    console.log(kra);
                    const kraKPIs = goalRatings.filter((kpi) => kpi.kra_id === kra.id);
                    const isExpanded = expandedKRAs[kra.id] || false;
                    
                    return (
                      <Card key={kra.id} className="border-l-4 border-l-card-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 mt-1"
                              onClick={() => setExpandedKRAs(prev => ({ ...prev, [kra.id]: !prev[kra.id] }))}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-[hsl(var(--card-arrow))]" /> : <ChevronRight className="h-4 w-4 text-[hsl(var(--card-arrow))]" />}
                            </Button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="bg-primary/10">KRA</Badge>
                                <span className="text-sm font-medium text-primary">Weight: {kra.weight}%</span>
                                <span className="text-sm text-muted-foreground">({kraKPIs.length} KPIs)</span>
                              </div>
                              <CardTitle className="text-lg">{kra.title}</CardTitle>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calculator className="h-3 w-3" />
                                KRA Ratings
                              </div>
                              <div className="text-sm  font-normal text-primary">
                                <span className="text-right text-sm font-medium"> Self: </span> <span className="text-right ">{getRatingLabel(kra.self_rating)}</span>
                              </div>
                              <div className="text-sm font-normal text-primary mt-1">
                                 <span className="text-right text-sm font-medium"> Manager: </span> <span className="text-right ">{getRatingLabel(kra.manager_rating)}</span>
                                </div>
                            </div>
                          </div>
                        </CardHeader>

                        {isExpanded && (
                          <CardContent className="space-y-4">
                            {/* KPIs under this KRA */}
                            {kraKPIs.length > 0 && (
                              <div className="space-y-3">
                                {kraKPIs.map((kpi) => (
                                  <div key={kpi.id} className="p-4 rounded-lg border bg-card">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Badge variant="secondary">KPI</Badge>
                                          <span className="text-sm text-muted-foreground">Weight: {kpi.weight}%</span>
                                        </div>
                                        <h5 className="font-medium">{kpi.title}</h5>
                                      </div>
                                    </div>
                                    
                                    <div className="mt-3">
                                      <div className="p-3 rounded bg-muted/30">
                                        <div className="text-xs text-muted-foreground mb-1">Your Self Ratings</div>
                                        <div className="font-medium">{getRatingLabel(kpi.self_rating)}</div>
                                      </div>
                                    
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </>
        )}

        {(evaluationState === 'hr_approved' || evaluationState === 'employee_accepted' || evaluationState === 'employee_rejected') && (
          <>
            <Card >
              <CardHeader >
                <CardTitle className="flex items-center gap-2 ">
                  <Calculator className="h-5 w-5" />
                  Overall Assessment
                  {isPreTransitionView && (
                    <Badge variant="outline" className="ml-2">
                      Pre-Transition
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center rounded-lg bg-amber-100/100 border-2 border-amber-300">
                  <div className="text-sm text-muted-foreground mb-2">Performance Rating</div>
                  <div className="text-4xl font-bold text-primary mb-2">
                    {calibratedRating !== null && calibratedRating !== undefined
                      ? formatRating(calibratedRating)
                      : managerReview?.calculated_overall_rating 
                        ? formatRating(managerReview.calculated_overall_rating)
                        : '-'}
                  </div>
                </div>
              </CardContent>
            </Card>

          {/* KRA and KPI Ratings */}
          <Card className=" hover:shadow-md transition-shadow ">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                KRA & KPI Ratings
              </CardTitle>
              <CardDescription>
                Your self-evaluation and manager ratings for Q{selectedQuarter}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {kraRatings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No KRAs found for Q{selectedQuarter}</p>
                </div>
              ) : (
                kraRatings.map((kra) => {
                  const kraKPIs = goalRatings.filter((kpi) => kpi.kra_id === kra.id);
                  const isExpanded = expandedKRAs[kra.id] || false;
                  
                  return (
                    <Card key={kra.id} className="border-l-4 border-l-card-border bg-gray-100 hover:shadow-md">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 mt-1"
                            onClick={() => setExpandedKRAs(prev => ({ ...prev, [kra.id]: !prev[kra.id] }))}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-[hsl(var(--card-arrow))]" /> : <ChevronRight className="h-4 w-4 text-[hsl(var(--card-arrow))]" />}
                          </Button>
                          <div className="flex-1 ">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="bg-primary/10">KRA</Badge>
                              <span className="text-sm font-medium text-primary">Weight: {kra.weight}%</span>
                              <span className="text-sm text-muted-foreground">({kraKPIs.length} KPIs)</span>
                            </div>
                            <CardTitle className="text-lg">{kra.title}</CardTitle>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calculator className="h-3 w-3" />
                              KRA Rating
                            </div>
                            <div className="text-right flex flex-col justify-between items-start gap-1">
                            {kra.manager_rating && (
                              <div className="text-sm font-normal text-primary mt-1">
                               <span className="text-right text-sm font-medium"> Manager: </span> <span className="text-right ">{getRatingLabel(kra.manager_rating)}</span>
                              </div>
                            )}
                            <div className="text-sm  font-normal text-primary">
                              <span className="text-right text-sm font-medium"> Self: </span> <span className="text-right ">{getRatingLabel(kra.self_rating)}</span>
                            </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>

                      {isExpanded && (
                        <CardContent className="space-y-4">
                          {/* KPIs under this KRA */}
                          {kraKPIs.length > 0 && (
                            <div className="space-y-3">
                              {kraKPIs.map((kpi) => (
                                <div key={kpi.id} className="p-4 rounded-lg border bg-card">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="secondary">KPI</Badge>
                                        <span className="text-sm text-muted-foreground">Weight: {kpi.weight}%</span>
                                      </div>
                                      <h5 className="font-medium">{kpi.title}</h5>
                                    </div>
                                  </div>
                                  
                                  <div className="grid gap-4 sm:grid-cols-2 mt-3">
                                    <div className="p-3 rounded bg-muted/30">
                                      <div className="text-xs text-muted-foreground mb-1">Your Self Rating</div>
                                      <div className="font-medium">{getRatingLabel(kpi.self_rating)}</div>
                                    </div>
                                    {kpi.manager_rating && (
                                      <div className="p-3 rounded bg-primary/5">
                                        <div className="text-xs text-muted-foreground mb-1">Manager Rating</div>
                                        <div className="font-medium">{getRatingLabel(kpi.manager_rating)}</div>
                                      </div>
                                    )}
                                  </div>

                                  {kpi.manager_comments && (
                                    <div className="mt-3 p-3 rounded bg-muted/20">
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                        <MessageSquare className="h-3 w-3" />
                                        Manager Feedback
                                      </div>
                                      <p className="text-sm">{kpi.manager_comments}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>

          {managerReview?.overall_comments && (
            <Card>
              <CardHeader>
                <CardTitle>Overall Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{managerReview.overall_comments}</p>
              </CardContent>
            </Card>
          )}

          {managerReview?.guidance && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Development Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>{managerReview.guidance}</p>
              </CardContent>
            </Card>
          )}

          {evaluationState === 'hr_approved' && (
            <Card>
              <CardHeader>
                <CardTitle>Accept or Reject Your Rating</CardTitle>
                <CardDescription>
                  Please review your rating and either accept or reject it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                <Button 
                    onClick={() => {
                      setIsYearEndRejection(false);
                      setShowRejectionConfirmation(true);
                    }} 
                    disabled={saving}
                    className="flex-1"
                    variant="destructive"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button 
                    onClick={handleAcceptRating} 
                    disabled={saving}
                    className="flex-1 "
                    variant="default"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Accept
                  </Button>
                
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
  };

  // Case: HR pending or HR approved or employee accepted/rejected (quarterly mode only - year-end handled by early return)
  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl ">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Rating</h1>
            <p className="text-muted-foreground">
              {managerReview?.released_at 
                ? `Released on ${new Date(managerReview.released_at).toLocaleDateString()}`
                : `Q${selectedQuarter} Performance Rating`}
            </p>
          </div>
          {evaluationState === 'employee_accepted' && (
            <Badge variant="outline" className="bg-green-50">
              <CheckCircle className="mr-1 h-3 w-3" />
              Accepted
            </Badge>
          )}
          {evaluationState === 'employee_rejected' && (
            <Badge variant="outline" className="bg-red-50">
              <XCircle className="mr-1 h-3 w-3" />
              Rejected
            </Badge>
          )}
        </div>

        {activeCycle && renderTabs(renderQuarterlyContent())}
      </div>

      {/* Rejection Confirmation Dialog */}
      <AlertDialog open={showRejectionConfirmation} onOpenChange={setShowRejectionConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Rating</AlertDialogTitle>
            <AlertDialogDescription>
              Please discuss with your manager once before rejecting your rating.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowRejectionConfirmation(false);
              setShowRejectionDialog(true);
            }}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justify your review / reason</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting your {isYearEndRejection ? 'year-end' : 'quarterly'} rating.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comment</Label>
              <Textarea
                placeholder="Enter your reason for rejecting the rating..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectionDialog(false);
              setRejectionReason('');
              setIsYearEndRejection(false);
            }}>
              Close
            </Button>
            <Button 
              onClick={handleRejectRating} 
              disabled={!rejectionReason.trim() || saving}
              // className="bg-blue-600 hover:bg-blue-700"
              variant="primary"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
