import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { employeeService, goalsService, evaluationService, settingsService, delegationService, permissionsService, transitionService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { useTransition, usePeriodRatings } from '@/hooks';
import { getPeriodLabel, getPeriodBadgeVariant, formatPeriodDateRange } from '@/utils/periodHelpers';
import { formatDateShort } from '@/utils/quarterHelpers';
import {
  Loader2,
  AlertCircle,
  Save,
  Send,
  Star,
  ArrowLeft,
  User,
  ChevronDown,
  ChevronRight,
  Calculator,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DualAchievementSlider, parseNumericTarget } from '@/components/evaluation/AchievementSlider';
import { CalibrationDisplay, calculateRatingFromCalibration } from '@/components/evaluation/CalibrationDisplay';
import { EvaluationPeriodTabs } from '@/components/evaluation/EvaluationPeriodTabs';
import { KPIEvidenceView } from '@/components/evaluation/KPIEvidenceView';
import { 
  calculateAllKRARatings, 
  calculateQuarterRating, 
  calculateYearEndRating, 
  formatRating,
} from '@/lib/ratingCalculations';
import {
  Quarter,
  getCurrentQuarter,
  getQuarterManagerReviewStatus,
  getYearEndManagerEvalStatus,
  PerformanceCycle,
} from '@/lib/evaluationPeriods';
import type { QuarterlyCycle } from '@/services/cycle.service';
import type { Employee } from '@/types';

// Helper function to get initials from employee name
const getEmployeeInitials = (employee: Employee | null | undefined): string => {
  try {
    if (!employee || !employee.full_name || typeof employee.full_name !== 'string') {
      return '??';
    }
    const trimmed = employee.full_name.trim();
    if (!trimmed) {
      return '??';
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    if (parts[0] && parts[0][0]) {
      return parts[0][0].toUpperCase();
    }
    return '??';
  } catch (error) {
    console.error('Error in getEmployeeInitials:', error);
    return '??';
  }
};

const getEmployeeDisplayName = (employee: Employee | null | undefined): string => {
  try {
    if (!employee || !employee.full_name || typeof employee.full_name !== 'string') {
      return 'Unknown';
    }
    return employee.full_name.trim() || 'Unknown';
  } catch (error) {
    console.error('Error in getEmployeeDisplayName:', error);
    return 'Unknown';
  }
};

// Helper function to get first name only (for messages)
const getEmployeeFirstName = (employee: Employee | null | undefined): string => {
  try {
    if (!employee || !employee.full_name || typeof employee.full_name !== 'string') {
      return 'Unknown';
    }
    const trimmed = employee.full_name.trim();
    if (!trimmed) {
      return 'Unknown';
    }
    const parts = trimmed.split(/\s+/);
    return parts[0] || 'Unknown';
  } catch (error) {
    console.error('Error in getEmployeeFirstName:', error);
    return 'Unknown';
  }
};

interface KRADisplay {
  id: string;
  title: string;
  description?: string | null;
  weight: number;
  quarter?: number | null;
  period_type?: 'full_quarter' | 'pre_transition' | 'post_transition' | null;
  transition_id?: string | null;
}

interface KPIDisplay {
  id: string;
  kra_id: string;
  title: string;
  description?: string | null;
  weight: number;
  target_value?: string | null;
  calibration?: Array<{ threshold: number; rating: number }> | null;
  quarter?: number | null;
  metric_type?: string | null;
  period_type?: 'full_quarter' | 'pre_transition' | 'post_transition' | null;
  transition_id?: string | null;
}

interface GoalSelfRating {
  goal_id: string;
  achievement: string | null;
  self_rating: number | null;
  evidence: string | null;
  achieved_value?: number | null;
  target_value?: number | null;
  metric_type?: string;
}

interface GoalManagerRating {
  goal_id: string;
  rating: number | null;
  comments: string;
  manager_achieved_value?: number | null;
  progress_percentage?: number | null;
}

interface RatingScaleDisplay {
  name: string;
  value: number;
  description: string | null;
  color: string | null;
}


interface QuarterlySelfEval {
  id: string;
  quarter: number;
  status: string;
  overall_rating: number | null;
  overall_comments: string | null;
  calculated_overall_rating: number | null;
  period_type?: string | null;
  transition_id?: string | null;
}

export default function ManagerEvaluation() {
  const { employeeId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuarter = searchParams.get('quarter');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Get active cycle data from context (fetched once at app initialization)
  const { activeCycle: activeCycleFromContext, quarterlyCycles: quarterlyCyclesFromContext, isLoading: isLoadingActiveCycle, managerReview } = useActiveCycle();
  // Get current employee from cached hook (fetched once at app initialization)
  const { employee: currentEmployee } = useCurrentEmployee();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [managerId, setManagerId] = useState<string | null>(currentEmployee?.id || null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeCycle, setActiveCycle] = useState<PerformanceCycle | null>(() => {
    // Safely initialize with null if activeCycleFromContext is not available
    return activeCycleFromContext && activeCycleFromContext.id ? activeCycleFromContext : null;
  });
  const [quarterlyCycles, setQuarterlyCycles] = useState<QuarterlyCycle[]>((quarterlyCyclesFromContext || []) as QuarterlyCycle[]);
  const [kras, setKras] = useState<KRADisplay[]>([]);
  const [kpis, setKpis] = useState<KPIDisplay[]>([]);
  const [ratingScales, setRatingScales] = useState<RatingScaleDisplay[]>([]);
  
  const [quarterlySelfEvals, setQuarterlySelfEvals] = useState<Record<number, QuarterlySelfEval>>({});
  const [quarterlyGoalSelfRatings, setQuarterlyGoalSelfRatings] = useState<Record<number, Record<string, GoalSelfRating>>>({});
  
  const [selfEvaluation, setSelfEvaluation] = useState<any>(null);
  const [goalSelfRatings, setGoalSelfRatings] = useState<Record<string, GoalSelfRating>>({});
  
  const [managerEvaluation, setManagerEvaluation] = useState<any>(null);
  const [preTransitionReview, setPreTransitionReview] = useState<any>(null);
  const [postTransitionReview, setPostTransitionReview] = useState<any>(null);
  const [yearEndManagerEvaluation, setYearEndManagerEvaluation] = useState<any>(null);
  const [goalManagerRatings, setGoalManagerRatings] = useState<Record<string, GoalManagerRating>>({});
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [potentialRating, setPotentialRating] = useState<number | null>(null);
  const [overallComments, setOverallComments] = useState('');
  const [yearEndOverallComments, setYearEndOverallComments] = useState('');
  const [developmentRecommendations, setDevelopmentRecommendations] = useState('');
  const [expandedKRAs, setExpandedKRAs] = useState<Set<string>>(new Set());
  const [quarterlyRatings, setQuarterlyRatings] = useState<{
    q1: number | null;
    q2: number | null;
    q3: number | null;
    q4: number | null;
  }>({ q1: null, q2: null, q3: null, q4: null });
  
  // Evaluation mode: 'quarterly' or 'year-end'
  const [evaluationMode, setEvaluationMode] = useState<'quarterly' | 'year-end'>('quarterly');
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>(1);
  const [evaluationTab, setEvaluationTab] = useState<string>('goals');
  
  // Track nested tab within quarter for transition employees: 'pre-transition' or 'transition'
  const [nestedTab, setNestedTab] = useState<'pre-transition' | 'transition'>('pre-transition');
  const isTransitionTab = nestedTab === 'transition';
  
  // Separate evaluation tabs for each period (pre-transition and transition)
  const [preTransitionEvaluationTab, setPreTransitionEvaluationTab] = useState<string>('goals');
  const [transitionEvaluationTab, setTransitionEvaluationTab] = useState<string>('goals');
  
  // HR Review Rating state
  const [hrReviewRatings, setHrReviewRatings] = useState<any[]>([]);
  const [hrReviewLoading, setHrReviewLoading] = useState(false);
  
  // Late submission permission state for manager evaluations
  const [hasLatePermission, setHasLatePermission] = useState(false);
  
  // KRA/KPI rejection state
  const [kraKpiRejections, setKraKpiRejections] = useState<Record<string, any>>({});
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectingItem, setRejectingItem] = useState<{ type: 'kra' | 'kpi'; id: string; title: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Fetch transition data for the selected quarter
  const { transition, loading: transitionLoading } = useTransition({
    employeeId: employeeId || undefined,
    cycleId: activeCycle?.id,
    quarter: selectedQuarter,
    enabled: !!employeeId && !!activeCycle,
  });
  
  // Fetch period ratings for the selected quarter
  const { periodRatings, finalRating, loading: periodRatingsLoading } = usePeriodRatings({
    employeeId: employeeId || undefined,
    cycleId: activeCycle?.id,
    quarter: selectedQuarter,
    enabled: !!employeeId && !!activeCycle,
  });

  // Determine manager role for transition filtering
  // Case 1: If old_manager_id ≠ new_manager_id (different managers)
  //   - Old manager: see only pre-transition data
  //   - New manager: see only post-transition data
  // Case 2: If new_manager_id is null/empty OR equals old_manager_id (same manager)
  //   - Manager: see both pre and post-transition data
  const managerRole = useMemo(() => {
    if (!transition || !currentEmployee || !transition.old_manager_id) {
      return null; // No transition or no current manager
    }

    const isOldManager = transition.old_manager_id === currentEmployee.id;
    const isNewManager = transition.new_manager_id && transition.new_manager_id === currentEmployee.id;
    const managersAreDifferent = transition.new_manager_id && 
                                  transition.new_manager_id !== transition.old_manager_id;

    if (managersAreDifferent) {
      // Different managers: show only relevant period
      if (isOldManager) {
        return 'old_manager'; // See only pre-transition
      } else if (isNewManager) {
        return 'new_manager'; // See only post-transition
      } else {
        return null; // Not involved in this transition
      }
    } else {
      // Same manager (new_manager_id is null/empty or equals old_manager_id)
      if (isOldManager || isNewManager) {
        return 'same_manager'; // See both pre and post-transition
      } else {
        return null; // Not involved in this transition
      }
    }
  }, [transition, currentEmployee]);
  
  // Determine current quarter from backend response or cycle
  const currentQuarter = useMemo(() => {
    if (!activeCycle) return 1 as Quarter; // Default to Q1 if no active cycle
    // Use backend response if available, otherwise fall back to date calculation
    const backendQuarter = managerReview?.present_quarter;
    if (backendQuarter && backendQuarter >= 1 && backendQuarter <= 4) {
      return backendQuarter as Quarter;
    }
    return getCurrentQuarter(activeCycle, quarterlyCycles);
  }, [activeCycle, quarterlyCycles, managerReview]);

  useEffect(() => {
    if (activeCycle) {
      if (initialQuarter && parseInt(initialQuarter) >= 1 && parseInt(initialQuarter) <= 4) {
        setSelectedQuarter(parseInt(initialQuarter) as Quarter);
        setEvaluationMode('quarterly');
      } else {
        // Use backend response to determine default quarter for manager review
        if (managerReview?.enabled && managerReview?.review_for_quarter) {
          setSelectedQuarter(managerReview.review_for_quarter as Quarter);
        } else {
          setSelectedQuarter(currentQuarter);
        }
        setEvaluationMode('quarterly');
      }
    }
  }, [activeCycle, initialQuarter, currentQuarter, managerReview]);

  // Update managerId when employee data changes
  useEffect(() => {
    if (currentEmployee) {
      setManagerId(currentEmployee.id);
    }
  }, [currentEmployee]);

  const fetchData = useCallback(async () => {
    if (!user || !employeeId || !currentEmployee) return;

    try {
      const managerId = currentEmployee.id;

      // Fetch the employee being evaluated
      const empResult = await employeeService.getById(employeeId);

      if (!empResult.data) {
        toast({ title: 'Employee not found', variant: 'destructive' });
        navigate('/team');
        setLoading(false);
        return;
      }

      // Check authorization: manager_code stores emp_code value
      const employee = empResult.data as any;
      const managerCode = employee.manager_code;
      const managerEmpCode = currentEmployee.emp_code;
      
      // Check if user is direct manager
      const isDirectManager = managerCode === managerEmpCode;
      
      // If not direct manager, check for delegation (check all quarters for authorization)
      let isDelegate = false;
      if (!isDirectManager && activeCycleFromContext?.id) {
        try {
          // Check delegations without quarter filter to see if user is authorized at all
          const delegationsResult = await delegationService.get({
            delegate_id: currentEmployee.id,
            reportee_id: employeeId,
            cycle_id: activeCycleFromContext.id,
          });
          isDelegate = (delegationsResult.data || []).length > 0;
        } catch (error) {
          console.error('Error checking delegation:', error);
        }
      }
      
      // Check if user is the new manager in a transition (for any quarter in the cycle)
      let isTransitionManager = false;
      if (!isDirectManager && !isDelegate && activeCycleFromContext?.id) {
        try {
          // Check if there's a transition where current user is the new manager
          // We need to check all quarters since we don't know which quarter yet
          const transitions = await transitionService.getByEmployee(
            employeeId,
            activeCycleFromContext.id,
            null // Check all quarters
          );
          
          if (transitions && Array.isArray(transitions)) {
            // Check if any transition has current user as new_manager_id
            isTransitionManager = transitions.some((t: any) => 
              t.new_manager_id === currentEmployee.id
            );
            
            if (isTransitionManager) {
              console.log('[Authorization] User is new manager in transition for employee', employeeId);
            }
          }
        } catch (error) {
          console.error('Error checking transition authorization:', error);
        }
      }
      
      if (!isDirectManager && !isDelegate && !isTransitionManager) {
        toast({ title: 'Not authorized to evaluate this employee', variant: 'destructive' });
        navigate('/team');
        setLoading(false);
        return;
      }

      setEmployee(employee);

      // Use active cycle data from context (already fetched at app initialization)
      if (!activeCycleFromContext) {
        setLoading(false);
        return;
      }
      setActiveCycle(activeCycleFromContext);
      if (quarterlyCyclesFromContext) {
        setQuarterlyCycles((quarterlyCyclesFromContext || []) as QuarterlyCycle[]);
      }

      // Fetch rating scales
      const scalesResult = await settingsService.ratingScales.getDefault();
      const scales = (scalesResult.data || []).map((s: any) => ({
        value: s.rating ?? s.value,
        name: s.label ?? s.name,
        description: s.description || null,
        color: s.color || null,
      }));
      setRatingScales(scales);

      // Fetch KRAs for this employee - fetch for selected quarter to ensure manager role filtering is applied
      // For transitions, fetch based on active nestedTab and manager role:
      // - If transition tab is selected (for new_manager or same_manager), fetch post-transition goals with period_type and transition_id
      // - If pre-transition tab is selected (for old_manager or same_manager), fetch pre-transition goals with period_type and transition_id
      // - Otherwise, fetch all goals (full_quarter, or all if no transition)
      // Note: Pre-transition KRAs have status='locked', so we fetch without status filter
      // activeCycleFromContext is already checked above, so it's safe to use .id
      // Fetch with selectedQuarter to ensure API applies correct manager role filtering
      
      // Compute manager role first to determine what to fetch
      let computedManagerRole: 'old_manager' | 'new_manager' | 'same_manager' | null = null;
      if (transition && transition.quarter === selectedQuarter && currentEmployee) {
        const isOldManager = transition.old_manager_id === currentEmployee.id;
        const isNewManager = transition.new_manager_id && transition.new_manager_id === currentEmployee.id;
        const managersAreDifferent = transition.new_manager_id && 
                                    transition.new_manager_id !== transition.old_manager_id;
        
        if (managersAreDifferent) {
          if (isOldManager) {
            computedManagerRole = 'old_manager';
          } else if (isNewManager) {
            computedManagerRole = 'new_manager';
          }
        } else {
          computedManagerRole = 'same_manager';
        }
      }
      
      // Determine what to fetch based on manager role
      // For old_manager: always fetch pre_transition (no tabs)
      // For new_manager: always fetch post_transition (no tabs)
      // For same_manager: fetch based on nestedTab (has tabs)
      let periodTypeForFetch: 'pre_transition' | 'post_transition' | undefined = undefined;
      let transitionIdForFetch: string | undefined = undefined;
      
      if (transition && transition.quarter === selectedQuarter) {
        if (computedManagerRole === 'old_manager') {
          // Old manager: always fetch pre-transition goals (no tabs)
          periodTypeForFetch = 'pre_transition';
          transitionIdForFetch = transition.id;
        } else if (computedManagerRole === 'new_manager') {
          // New manager: always fetch post-transition goals (no tabs)
          periodTypeForFetch = 'post_transition';
          transitionIdForFetch = transition.id;
        } else if (computedManagerRole === 'same_manager') {
          // Same manager: fetch based on nestedTab (has tabs)
          if (isTransitionTab) {
            periodTypeForFetch = 'post_transition';
            transitionIdForFetch = transition.id;
          } else {
            periodTypeForFetch = 'pre_transition';
            transitionIdForFetch = transition.id;
          }
        }
      }
      
      const krasResult = await goalsService.kras.getByEmployee(
        employeeId, 
        activeCycleFromContext!.id, 
        undefined, // No status filter - we want both 'approved' and 'locked' (for pre-transition)
        selectedQuarter, // Include quarter to ensure API applies manager role filtering
        periodTypeForFetch, // period_type when transition tab is selected
        transitionIdForFetch // transition_id when transition tab is selected
      );
      const mappedKras = (krasResult.data || [])
        .filter((kra: any) => kra.status === 'approved' || kra.status === 'locked' || kra.status === 'submitted')
        .map((kra: any) => ({
          id: kra.id,
          title: kra.title,
          description: kra.description,
          weight: kra.weight,
          quarter: kra.quarter || null,
          period_type: kra.period_type || null,
          transition_id: kra.transition_id || null,
        }));
      console.log('ManagerEvaluation - All KRAs fetched (approved/locked/submitted):', mappedKras.length, mappedKras.map(k => ({ 
        id: k.id, 
        quarter: k.quarter, 
        period_type: k.period_type, 
        transition_id: k.transition_id,
        status: krasResult.data?.find((kra: any) => kra.id === k.id)?.status
      })));
      setKras(mappedKras);

      // Fetch KPIs (goals with kra_id) - fetch for selected quarter to ensure manager role filtering is applied
      // For transitions, fetch based on active nestedTab:
      // - If transition tab is selected, fetch post-transition goals with period_type and transition_id
      // - Otherwise, fetch all goals (pre-transition, full_quarter, or all if no transition)
      // Note: Pre-transition KPIs have status='locked', so we fetch without status filter
      // activeCycleFromContext is already checked above, so it's safe to use .id
      // Fetch with selectedQuarter to ensure API applies correct manager role filtering
      // Reuse periodTypeForFetch and transitionIdForFetch from KRA fetch above
      const kpisResult = await goalsService.kpis.getByEmployee(
        employeeId, 
        activeCycleFromContext!.id, 
        undefined, // No status filter - we want both 'approved' and 'locked' (for pre-transition)
        selectedQuarter, // Include quarter to ensure API applies manager role filtering
        periodTypeForFetch, // period_type when transition tab is selected
        transitionIdForFetch // transition_id when transition tab is selected
      );
      // Filter to only include KPIs with kra_id and status='approved', 'locked', or 'submitted'
      const filteredKpis = (kpisResult.data || [])
        .filter((kpi: any) => kpi.kra_id && (kpi.status === 'approved' || kpi.status === 'locked' || kpi.status === 'submitted'))
        .map((kpi: any) => ({
          id: kpi.id,
          kra_id: kpi.kra_id as string,
          title: kpi.title,
          description: kpi.description,
          weight: kpi.weight,
          target_value: kpi.target_value,
          calibration: kpi.calibration || null,
          quarter: kpi.quarter || null,
          metric_type: kpi.metric_type || null,
          period_type: kpi.period_type || null,
          transition_id: kpi.transition_id || null,
        }));

      setKpis(filteredKpis);

      // Fetch quarterly self reviews (from quarterly_self_reviews table)
      // For transition employees, fetch period-specific self-reviews based on manager role
      // activeCycleFromContext is already checked above, so it's safe to use .id
      
      // Reuse computedManagerRole that was already computed above for KRA/KPI fetching
      
      let allQuarterlySelfResult;
      
      // Check if we have a transition for the selected quarter
      if (transition && transition.quarter === selectedQuarter) {
        // For transition employees, fetch the correct period-specific self-review
        // For old_manager: always pre-transition (no tabs)
        // For new_manager: always post-transition (no tabs)
        // For same_manager: fetch based on nestedTab (has tabs)
        let periodType: 'pre_transition' | 'post_transition' | null = null;
        
        if (computedManagerRole === 'old_manager') {
          // Old manager: always pre-transition (no tabs)
          periodType = 'pre_transition';
        } else if (computedManagerRole === 'new_manager') {
          // New manager: always post-transition (no tabs)
          periodType = 'post_transition';
        } else if (computedManagerRole === 'same_manager') {
          // Same manager: fetch based on nestedTab (has tabs)
          periodType = isTransitionTab ? 'post_transition' : 'pre_transition';
        }
        
        if (periodType) {
          // Fetch specific period self-review
          allQuarterlySelfResult = await evaluationService.selfReviews.get(
            employeeId, 
            activeCycleFromContext!.id,
            selectedQuarter,
            periodType,
            transition.id
          );
          console.log(`[ManagerEvaluation] Fetched ${periodType} self-review for transition employee (managerRole: ${computedManagerRole}, nestedTab: ${nestedTab}, isTransitionTab: ${isTransitionTab}):`, allQuarterlySelfResult);
        } else {
          // Fetch all self-reviews for the quarter (fallback)
          allQuarterlySelfResult = await evaluationService.selfReviews.get(employeeId, activeCycleFromContext!.id);
        }
      } else {
        // No transition for this quarter, fetch all self-reviews normally
        allQuarterlySelfResult = await evaluationService.selfReviews.get(employeeId, activeCycleFromContext!.id);
      }
      
      console.log('allQuarterlySelfResult', allQuarterlySelfResult);

      const qSelfEvalsMap: Record<number, QuarterlySelfEval> = {};
      (allQuarterlySelfResult.data || []).forEach((e: any) => {
        if (e.quarter) {
          // For transition employees, only include the relevant period self-review
          if (transition && transition.quarter === e.quarter) {
            const isPostTransition = e.period_type === 'post_transition';
            const isPreTransition = e.period_type === 'pre_transition';
            
            // Filter based on manager role AND nestedTab state
            let shouldInclude = false;
            
            if (computedManagerRole === 'new_manager' && isPostTransition) {
              // New manager: only post-transition
              shouldInclude = true;
            } else if (computedManagerRole === 'old_manager' && isPreTransition) {
              // Old manager: only pre-transition
              shouldInclude = true;
            } else if (computedManagerRole === 'same_manager' || !computedManagerRole) {
              // Same manager or no role: filter based on nestedTab
              if (isTransitionTab && isPostTransition) {
                // Transition tab selected: include post-transition
                shouldInclude = true;
              } else if (!isTransitionTab && isPreTransition) {
                // Pre-transition tab selected: include pre-transition
                shouldInclude = true;
              }
            }
            
            if (shouldInclude) {
              qSelfEvalsMap[e.quarter] = {
                id: e.id,
                quarter: e.quarter,
                status: e.status,
                overall_rating: e.overall_rating ?? null,
                overall_comments: e.overall_comments,
                calculated_overall_rating: null, // Not stored in quarterly_self_reviews
                period_type: e.period_type,
                transition_id: e.transition_id,
              };
            }
          } else {
            // No transition for this quarter, include normally
            qSelfEvalsMap[e.quarter] = {
              id: e.id,
              quarter: e.quarter,
              status: e.status,
              overall_rating: e.overall_rating ?? null,
              overall_comments: e.overall_comments,
              calculated_overall_rating: null, // Not stored in quarterly_self_reviews
            };
          }
        }
      });
      setQuarterlySelfEvals(qSelfEvalsMap);

      // Fetch goal self ratings for each quarterly self review
      // For transition employees, we need to fetch ratings for the correct period-specific self-review
      // based on the active nestedTab
      const qGoalRatingsMap: Record<number, Record<string, GoalSelfRating>> = {};
      
      for (const [quarter, qEval] of Object.entries(qSelfEvalsMap)) {
        if (!qEval.id) {
          qGoalRatingsMap[parseInt(quarter)] = {};
          continue;
        }
        
        try {
          const qRatingsResult = await evaluationService.goalSelfRatings.get(qEval.id);
          console.log(`[ManagerEvaluation] Fetched goal self ratings for Q${quarter} (self-review ID: ${qEval.id}, period_type: ${qEval.period_type}, transition_id: ${qEval.transition_id}):`, qRatingsResult);

          const ratingsMap: Record<string, GoalSelfRating> = {};
          (qRatingsResult.data || []).forEach((r: any) => {
            ratingsMap[r.goal_id] = {
              goal_id: r.goal_id,
              achievement: r.achievement || '',
              self_rating: r.self_rating,
              evidence: r.evidence || '',
              achieved_value: r.achieved_value,
              target_value: r.target_value,
              metric_type: r.metric_type || '',
            };
          });
          console.log(`[ManagerEvaluation] Mapped goal self ratings for Q${quarter} (period_type: ${qEval.period_type}):`, {
            ratingsCount: Object.keys(ratingsMap).length,
            goalIds: Object.keys(ratingsMap),
            ratingsMap
          });
          
          // For transition employees, only store ratings if they match the active tab
          // This ensures we have the correct ratings for the active period
          if (transition && transition.quarter === parseInt(quarter)) {
            // Check if this self-eval matches the active nestedTab
            const matchesActiveTab = (isTransitionTab && qEval.period_type === 'post_transition') ||
                                     (!isTransitionTab && qEval.period_type === 'pre_transition');
            
            if (matchesActiveTab || managerRole === 'old_manager' || managerRole === 'new_manager') {
              // Store ratings for the matching period
              qGoalRatingsMap[parseInt(quarter)] = ratingsMap;
            }
          } else {
            // No transition: store normally
            qGoalRatingsMap[parseInt(quarter)] = ratingsMap;
          }
        } catch (error) {
          console.error(`Error fetching goal self ratings for Q${quarter}:`, error);
          qGoalRatingsMap[parseInt(quarter)] = {};
        }
      }
      setQuarterlyGoalSelfRatings(qGoalRatingsMap);

      const q4SelfEval = qSelfEvalsMap[4];
      if (q4SelfEval) {
        setSelfEvaluation(q4SelfEval as any);
        setGoalSelfRatings(qGoalRatingsMap[4] || {});
      }

      // Fetch or create quarterly manager review (instead of manager_evaluations)
      // For transition employees, fetch period-specific manager review based on manager role
      // activeCycleFromContext is already checked above, so it's safe to use .id
      let mgrReviewsResult;
      
      // For transition employees, we need to fetch ALL manager reviews to check submission status
      // This allows us to check if pre-transition review has been submitted (by old manager)
      // and if post-transition review has been submitted (by new manager)
      if (transition && transition.quarter === selectedQuarter) {
        // Fetch pre-transition and post-transition reviews separately to bypass manager role filtering
        // This ensures we can check submission status for both periods
        const [preTransitionResult, postTransitionResult, allReviewsResult] = await Promise.all([
          evaluationService.managerReviews.get(
            employeeId, 
            activeCycleFromContext!.id,
            selectedQuarter,
            'pre_transition',
            transition.id
          ),
          evaluationService.managerReviews.get(
            employeeId, 
            activeCycleFromContext!.id,
            selectedQuarter,
            'post_transition',
            transition.id
          ),
          // Also fetch all reviews to get the one for current manager role
          evaluationService.managerReviews.get(
            employeeId, 
            activeCycleFromContext!.id,
            selectedQuarter
          )
        ]);
        
        // Combine all reviews
        const allReviews = [
          ...(preTransitionResult.data || []),
          ...(postTransitionResult.data || []),
          ...(allReviewsResult.data || [])
        ];
        
        // Remove duplicates based on review ID
        const uniqueReviews = Array.from(
          new Map(allReviews.map((r: any) => [r.id, r])).values()
        );
        
        mgrReviewsResult = { data: uniqueReviews };
        console.log(`[ManagerEvaluation] Fetched all manager reviews for transition employee (quarter ${selectedQuarter}):`, {
          preTransition: preTransitionResult.data,
          postTransition: postTransitionResult.data,
          allReviews: allReviewsResult.data,
          combined: uniqueReviews
        });
      } else {
        // No transition for this quarter, fetch all manager reviews normally
        mgrReviewsResult = await evaluationService.managerReviews.get(employeeId, activeCycleFromContext!.id);
      }
      
      // Create maps for both pre and post-transition reviews
      const preTransitionReview: any = null;
      const postTransitionReview: any = null;
      const mgrReviewsByQuarter: Record<number, any> = {};
      
      (mgrReviewsResult.data || []).forEach((r: any) => {
        // For transition employees, separate pre and post-transition reviews
        if (transition && transition.quarter === r.quarter && r.transition_id === transition.id) {
          if (r.period_type === 'pre_transition') {
            // Store pre-transition review separately
            if (!preTransitionReview || (r.status === 'submitted' && preTransitionReview.status !== 'submitted')) {
              // Prefer submitted review if multiple exist
            }
          } else if (r.period_type === 'post_transition') {
            // Store post-transition review separately
            if (!postTransitionReview || (r.status === 'submitted' && postTransitionReview.status !== 'submitted')) {
              // Prefer submitted review if multiple exist
            }
          }
        }
        
        // Filter based on manager role AND nestedTab for the main review to display
        if (transition && transition.quarter === r.quarter) {
          const isPostTransition = r.period_type === 'post_transition';
          const isPreTransition = r.period_type === 'pre_transition';
          
          // Filter based on manager role AND nestedTab state
          let shouldInclude = false;
          
          if (computedManagerRole === 'new_manager' && isPostTransition && r.transition_id === transition.id) {
            // New manager: only post-transition
            shouldInclude = true;
          } else if (computedManagerRole === 'old_manager' && isPreTransition && r.transition_id === transition.id) {
            // Old manager: only pre-transition
            shouldInclude = true;
          } else if (computedManagerRole === 'same_manager' || !computedManagerRole) {
            // Same manager or no role: filter based on nestedTab
            if (isTransitionTab && isPostTransition && r.transition_id === transition.id) {
              // Transition tab selected: include post-transition
              shouldInclude = true;
            } else if (!isTransitionTab && isPreTransition && r.transition_id === transition.id) {
              // Pre-transition tab selected: include pre-transition
              shouldInclude = true;
            }
          }
          
          if (shouldInclude) {
            // Use the most recent or submitted review if multiple exist
            if (!mgrReviewsByQuarter[r.quarter] || (r.status === 'submitted' && mgrReviewsByQuarter[r.quarter].status !== 'submitted')) {
              mgrReviewsByQuarter[r.quarter] = r;
            }
          }
        } else {
          // No transition for this quarter, include normally
          mgrReviewsByQuarter[r.quarter] = r;
        }
      });

      // Find pre and post-transition reviews separately for submission status checking
      let preTransitionReviewForStatus: any = null;
      let postTransitionReviewForStatus: any = null;
      
      if (transition && transition.quarter === selectedQuarter) {
        console.log(`[ManagerEvaluation] Checking manager reviews for transition (quarter ${selectedQuarter}, transition_id: ${transition.id}):`, mgrReviewsResult.data);
        (mgrReviewsResult.data || []).forEach((r: any) => {
          if (r.quarter === selectedQuarter && r.transition_id === transition.id) {
            if (r.period_type === 'pre_transition') {
              if (!preTransitionReviewForStatus || (r.status === 'submitted' && preTransitionReviewForStatus.status !== 'submitted')) {
                preTransitionReviewForStatus = r;
              }
            } else if (r.period_type === 'post_transition') {
              if (!postTransitionReviewForStatus || (r.status === 'submitted' && postTransitionReviewForStatus.status !== 'submitted')) {
                postTransitionReviewForStatus = r;
              }
            }
          }
        });
        console.log(`[ManagerEvaluation] Pre-transition review found:`, preTransitionReviewForStatus);
        console.log(`[ManagerEvaluation] Post-transition review found:`, postTransitionReviewForStatus);
      }

      // Use the manager review for selected quarter (filtered by period_type if transition exists)
      const existingReview = mgrReviewsByQuarter[selectedQuarter];
      
      // If we didn't find pre/post-transition reviews separately, use existingReview as fallback
      // This handles the case where the separate fetch didn't return the review but managerEvaluation has it
      if (transition && transition.quarter === selectedQuarter) {
        if (!preTransitionReviewForStatus && existingReview && existingReview.period_type === 'pre_transition' && existingReview.transition_id === transition.id) {
          preTransitionReviewForStatus = existingReview;
          console.log(`[ManagerEvaluation] Using existingReview as pre-transition review fallback:`, {
            existingReview: {
              id: existingReview.id,
              status: existingReview.status,
              period_type: existingReview.period_type,
              transition_id: existingReview.transition_id
            }
          });
        }
        if (!postTransitionReviewForStatus && existingReview && existingReview.period_type === 'post_transition' && existingReview.transition_id === transition.id) {
          postTransitionReviewForStatus = existingReview;
          console.log(`[ManagerEvaluation] Using existingReview as post-transition review fallback:`, {
            existingReview: {
              id: existingReview.id,
              status: existingReview.status,
              period_type: existingReview.period_type,
              transition_id: existingReview.transition_id
            }
          });
        }
        
        // Also check all reviews in mgrReviewsResult.data for fallback
        // This ensures we catch reviews that might not be in mgrReviewsByQuarter
        if (!preTransitionReviewForStatus || !postTransitionReviewForStatus) {
          (mgrReviewsResult.data || []).forEach((r: any) => {
            if (r.quarter === selectedQuarter && r.transition_id === transition.id) {
              if (!preTransitionReviewForStatus && r.period_type === 'pre_transition') {
                preTransitionReviewForStatus = r;
                console.log(`[ManagerEvaluation] Found pre-transition review in all reviews:`, {
                  id: r.id,
                  status: r.status,
                  period_type: r.period_type,
                  transition_id: r.transition_id
                });
              }
              if (!postTransitionReviewForStatus && r.period_type === 'post_transition') {
                postTransitionReviewForStatus = r;
                console.log(`[ManagerEvaluation] Found post-transition review in all reviews:`, {
                  id: r.id,
                  status: r.status,
                  period_type: r.period_type,
                  transition_id: r.transition_id
                });
              }
            }
          });
        }
      }
      
      // Store pre and post-transition reviews for submission status checking
      setPreTransitionReview(preTransitionReviewForStatus);
      setPostTransitionReview(postTransitionReviewForStatus);
   

      if (existingReview) {
        setManagerEvaluation(existingReview);
        setOverallComments(existingReview.overall_comments || '');
        setDevelopmentRecommendations(existingReview.guidance || '');

        // Fetch KPI manager feedback
        const mgrRatingsMap: Record<string, GoalManagerRating> = {};
        
        if (existingReview.id) {
          try {
            const mgrFeedbackResult = await evaluationService.kpiManagerFeedback.getByReview(existingReview.id);
         
            (mgrFeedbackResult.data || []).forEach((r: any) => {
              // Calculate manager_achieved_value from progress_percentage if available
              let managerAchievedValue = null;
              if (r.progress_percentage !== null && r.progress_percentage !== undefined) {
                // Find the KPI to get target_value
                const kpi = filteredKpis.find((k: any) => k.id === r.goal_id);
                if (kpi && kpi.target_value) {
                  const numericTarget = parseNumericTarget(kpi.target_value);
                  if (numericTarget) {
                    managerAchievedValue = (r.progress_percentage / 100) * numericTarget;
                  }
                }
              }
              
              mgrRatingsMap[r.goal_id] = {
                goal_id: r.goal_id,
                rating: r.rating,
                comments: r.comments || '',
                manager_achieved_value: managerAchievedValue,
                progress_percentage: r.progress_percentage,
              };
            });
          } catch (error) {
            console.error('Error fetching manager feedback:', error);
          }
        }

        filteredKpis.forEach((g: any) => {
          if (!mgrRatingsMap[g.id]) {
            mgrRatingsMap[g.id] = {
              goal_id: g.id,
              rating: null,
              comments: '',
              manager_achieved_value: null,
            };
          }
        });

        setGoalManagerRatings(mgrRatingsMap);

        // Set quarterly ratings from manager reviews (raw ratings)
        // These will be overridden by calibrated ratings from year-end evaluation if available
        const qRatings: Record<string, number | null> = { q1: null, q2: null, q3: null, q4: null };
        Object.entries(mgrReviewsByQuarter).forEach(([q, review]: [string, any]) => {
          const key = `q${q}` as keyof typeof qRatings;
          qRatings[key] = review.calculated_overall_rating;
        });
        setQuarterlyRatings(qRatings as any);
      } else {
        // Initialize empty manager ratings
        const emptyRatingsMap: Record<string, GoalManagerRating> = {};
        filteredKpis.forEach((g: any) => {
          emptyRatingsMap[g.id] = {
            goal_id: g.id,
            rating: null,
            comments: '',
            manager_achieved_value: null,
            progress_percentage: null,
          };
        });
        setGoalManagerRatings(emptyRatingsMap);
      }

      // Fetch KRA/KPI rejections for the selected quarter
      if (existingReview?.id && activeCycleFromContext) {
        try {
          const rejectionsResult = await evaluationService.kraKpiRejections.get({
            manager_review_id: existingReview.id,
            employee_id: employeeId,
            cycle_id: activeCycleFromContext.id,
            quarter: selectedQuarter,
          });
          
          // Create a map of rejections by KRA/KPI ID
          const rejectionsMap: Record<string, any> = {};
          (rejectionsResult.data || []).forEach((rejection: any) => {
            const key = rejection.kra_id || rejection.goal_id;
            if (key) {
              rejectionsMap[key] = rejection;
            }
          });
          setKraKpiRejections(rejectionsMap);
        } catch (error) {
          console.error('Error fetching KRA/KPI rejections:', error);
        }
      }

      // Always fetch year-end evaluation data (outside of quarterly review block)
      try {
        // activeCycleFromContext is already checked above, so it's safe to use .id
        const yearEndResult = await evaluationService.yearEndEvaluation.get(employeeId, activeCycleFromContext!.id);
        if (yearEndResult.data) {
          setYearEndManagerEvaluation(yearEndResult.data);
          // Populate year-end specific form fields
          if (yearEndResult.data.overall_rating !== null && yearEndResult.data.overall_rating !== undefined) {
            setOverallRating(yearEndResult.data.overall_rating);
          }
          if (yearEndResult.data.overall_comments) {
            // Store year-end comments in separate state variable
            setYearEndOverallComments(yearEndResult.data.overall_comments);
          }
          if (yearEndResult.data.potential_rating !== null && yearEndResult.data.potential_rating !== undefined) {
            setPotentialRating(yearEndResult.data.potential_rating);
          }
        
          setQuarterlyRatings({
            q1: yearEndResult.data.q1_rating ?? null,
            q2: yearEndResult.data.q2_rating ?? null,
            q3: yearEndResult.data.q3_rating ?? null,
            q4: yearEndResult.data.q4_rating ?? null,
          });
        }
      } catch (error) {
        console.log('No year-end evaluation found yet - this is normal for new evaluations');
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error loading evaluation data',
        description: error.message || 'Failed to load employee evaluation data. Please try again.',
        variant: 'destructive',
      });
      navigate('/team');
    } finally {
      setLoading(false);
    }
  }, [user, employeeId, currentEmployee, activeCycleFromContext, quarterlyCyclesFromContext, navigate, toast, selectedQuarter, transition, isTransitionTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const checkLatePermission = async () => {
      if (!activeCycle?.id || !currentEmployee?.id || evaluationMode !== 'quarterly') {
        setHasLatePermission(false);
        return;
      }
      try {
        const result = await permissionsService.lateSubmission.check(activeCycle.id, selectedQuarter);
        const permissions = result.data || [];
        const hasPermission = permissions.some((p: any) => {
          const isActive = !p.revoked_at;
          const quarterMatch = p.quarter === selectedQuarter || p.quarter === null;    
          return isActive && quarterMatch;
        });
        setHasLatePermission(hasPermission);
      } catch (error) {
        console.error('Error checking late permission:', error);
        setHasLatePermission(false);
      }
    };
    checkLatePermission();
  }, [activeCycle?.id, currentEmployee?.id, selectedQuarter, evaluationMode]);

  // Auto-calculate ratings from achievement values using calibration
  useEffect(() => {
    if (kpis.length === 0) return;
    
    // Get the appropriate self ratings based on selected quarter
    const currentSelfRatings = selectedQuarter && evaluationMode === 'quarterly'
      ? quarterlyGoalSelfRatings[selectedQuarter] || {}
      : goalSelfRatings;
    
    if (Object.keys(currentSelfRatings).length === 0) return;

    const updatedRatings = { ...goalManagerRatings };
    let hasChanges = false;


    kpis.forEach((kpi) => {
      const numericTarget = parseNumericTarget(kpi.target_value);
      if (numericTarget !== null) {
        const selfRating = currentSelfRatings[kpi.id];
        const employeeAchieved = selfRating?.achieved_value ?? 0;
        const managerAchieved = updatedRatings[kpi.id]?.manager_achieved_value ?? employeeAchieved;
        
        // Auto-calculate rating from calibration when manager_achieved_value exists
        if (managerAchieved > 0) {
          let autoRating: number | null = null;
          
          // Use calibration rules if available
          if (kpi.calibration && kpi.calibration.length > 0) {
            autoRating = calculateRatingFromCalibration(managerAchieved, kpi.calibration);
          } else {
            // Fallback: calculate based on percentage of target
            const percentage = numericTarget > 0 ? Math.round((managerAchieved / numericTarget) * 100) : 0;
            if (percentage >= 120) autoRating = 5;
            else if (percentage >= 110) autoRating = 4;
            else if (percentage >= 100) autoRating = 3;
            else if (percentage >= 90) autoRating = 2;
            else autoRating = 1;
          }
          
          // Update if rating changed or doesn't exist
          if (autoRating !== null && autoRating !== updatedRatings[kpi.id]?.rating) {
            updatedRatings[kpi.id] = {
              ...updatedRatings[kpi.id],
              goal_id: kpi.id,
              rating: autoRating,
              comments: updatedRatings[kpi.id]?.comments || '',
              manager_achieved_value: managerAchieved,
            };
            hasChanges = true;
          }
        }
      }
    });

    if (hasChanges) {
      setGoalManagerRatings(updatedRatings);
    }
  }, [kpis, selectedQuarter, evaluationMode, quarterlyGoalSelfRatings, goalSelfRatings, goalManagerRatings]);

  const calculatedYearEndRating = useMemo(() => {
    return calculateYearEndRating(quarterlyRatings);
  }, [quarterlyRatings]);

  // Filter KRAs and KPIs by selected quarter
  const quarterKras = useMemo(() => {
    if (evaluationMode !== 'quarterly') return kras;
    return kras.filter(kra => kra.quarter === selectedQuarter || kra.quarter === null);
  }, [kras, selectedQuarter, evaluationMode]);

  const quarterKpis = useMemo(() => {
    if (evaluationMode !== 'quarterly') return kpis;
    return kpis.filter(kpi => kpi.quarter === selectedQuarter || kpi.quarter === null);
  }, [kpis, selectedQuarter, evaluationMode]);

  console.log('quarterKpis',quarterKpis)

  // Helper function to get KPIs for a specific KRA (defined after quarterKpis)
  const getKPIsForKRA = useCallback((kraId: string) => {
    return quarterKpis.filter((kpi) => kpi.kra_id === kraId);
  }, [quarterKpis]);

  // Calculate KPI ratings using calibration rules (filtered by quarter)
  const calculatedKPIRatings = useMemo(() => {
    const kpiRatings: Record<string, number | null> = {};
    quarterKpis.forEach(kpi => {
      const managerAchieved = goalManagerRatings[kpi.id]?.manager_achieved_value;
      // Calculate rating from calibration if available
      if (kpi.calibration && kpi.calibration.length > 0 && managerAchieved !== null && managerAchieved !== undefined) {
        kpiRatings[kpi.id] = calculateRatingFromCalibration(managerAchieved, kpi.calibration);
      } else {
        // Fallback to stored rating
        kpiRatings[kpi.id] = goalManagerRatings[kpi.id]?.rating || null;
      }
    });
    return kpiRatings;
  }, [quarterKpis, goalManagerRatings]);

  // Calculate KRA ratings as weighted average of KPI ratings (filtered by quarter)
  const calculatedKRARatings = useMemo(() => {
    return calculateAllKRARatings(quarterKras, quarterKpis, calculatedKPIRatings);
  }, [quarterKras, quarterKpis, calculatedKPIRatings]);

  // Calculate overall quarter rating as weighted average of KRA ratings
  const calculatedQuarterRating = useMemo(() => {
    return calculateQuarterRating(quarterKras, calculatedKRARatings);
  }, [quarterKras, calculatedKRARatings]);

  const toggleKRA = (kraId: string) => {
    const newExpanded = new Set(expandedKRAs);
    if (newExpanded.has(kraId)) {
      newExpanded.delete(kraId);
    } else {
      newExpanded.add(kraId);
    }
    setExpandedKRAs(newExpanded);
  };

  const handleGoalRatingChange = (goalId: string, field: keyof GoalManagerRating, value: any) => {
    setGoalManagerRatings((prev) => {
      const updated = {
      ...prev,
      [goalId]: {
        ...prev[goalId],
          goal_id: goalId,
        [field]: value,
        }
      };
      
      // If manager_achieved_value changed, calculate rating from calibration and update progress_percentage
      if (field === 'manager_achieved_value' && value !== null && value !== undefined) {
        const kpi = kpis.find((k: any) => k.id === goalId);
        if (kpi && kpi.target_value) {
          const numericTarget = parseNumericTarget(kpi.target_value);
          if (numericTarget && numericTarget > 0) {
            const progressPercentage = Math.round((value / numericTarget) * 100);
            updated[goalId].progress_percentage = progressPercentage;
            
            // Auto-calculate rating from calibration
            if (kpi.calibration && kpi.calibration.length > 0) {
              const autoRating = calculateRatingFromCalibration(value, kpi.calibration);
              if (autoRating !== null) {
                updated[goalId].rating = autoRating;
              }
            } else {
              // Fallback: calculate based on percentage
              let autoRating = 3;
              if (progressPercentage >= 120) autoRating = 5;
              else if (progressPercentage >= 110) autoRating = 4;
              else if (progressPercentage >= 100) autoRating = 3;
              else if (progressPercentage >= 90) autoRating = 2;
              else autoRating = 1;
              updated[goalId].rating = autoRating;
            }
          }
        }
      }
      
      return updated;
    });
  };

  const handleSave = useCallback(async () => {
    if (!activeCycle || !managerId || !employeeId) return;

    setSaving(true);
    try {
      // For year-end evaluation, save to year-end evaluation API
      if (evaluationMode === 'year-end') {
        const result = await evaluationService.yearEndEvaluation.upsert({
          employee_id: employeeId,
          cycle_id: activeCycle.id,
          evaluator_id: managerId,
          overall_rating: overallRating,
          overall_comments: yearEndOverallComments,
          potential_rating: potentialRating,
          status: 'pending',
        });

        if (result.data) {
          setYearEndManagerEvaluation(result.data);
        }

        toast({ title: 'Year-end evaluation draft saved' });
        return;
      }

      // Determine period_type, transition_id, and period dates for transition employees
      let periodType: 'full_quarter' | 'pre_transition' | 'post_transition' | null = null;
      let transitionId: string | null = null;
      let periodStartDate: string | undefined = undefined;
      let periodEndDate: string | undefined = undefined;
      
      if (transition && transition.quarter === selectedQuarter) {
        transitionId = transition.id;
        
        if (managerRole === 'new_manager') {
          // New manager always reviews post-transition
          periodType = 'post_transition';
          periodStartDate = transition.post_period_start_date || undefined;
          periodEndDate = transition.post_period_end_date || undefined;
        } else if (managerRole === 'old_manager') {
          // Old manager always reviews pre-transition
          periodType = 'pre_transition';
          periodStartDate = transition.pre_period_start_date || undefined;
          periodEndDate = transition.pre_period_end_date || undefined;
        } else if (managerRole === 'same_manager' || !managerRole) {
          // Same manager reviews based on which nested tab is active
          if (nestedTab === 'transition') {
            // Transition tab = post-transition
            periodType = 'post_transition';
            periodStartDate = transition.post_period_start_date || undefined;
            periodEndDate = transition.post_period_end_date || undefined;
          } else {
            // Pre-transition tab = pre-transition
            periodType = 'pre_transition';
            periodStartDate = transition.pre_period_start_date || undefined;
            periodEndDate = transition.pre_period_end_date || undefined;
          }
        }
      }
      
      // Create or update quarterly manager review with calculated weighted average
      const mgrReviewResult = await evaluationService.managerReviews.upsert({
        employee_id: employeeId,
        cycle_id: activeCycle.id,
        quarter: selectedQuarter,
        reviewer_id: managerId,
        overall_comments: overallComments,
        guidance: developmentRecommendations,
        calculated_overall_rating: calculatedQuarterRating,
        status: 'in_progress',
        period_type: periodType,
        transition_id: transitionId,
        period_start_date: periodStartDate,
        period_end_date: periodEndDate,
      });

      if (mgrReviewResult.data) {
        setManagerEvaluation(mgrReviewResult.data);

        // Save KPI manager feedback
        // Get KPIs for the selected quarter
        const relevantKpis = evaluationMode === 'quarterly' 
          ? kpis.filter((k: any) => k.quarter === selectedQuarter)
          : kpis;
        
        const ratingsToSave = Object.values(goalManagerRatings)
          .filter(rating => rating.goal_id) // Only include ratings with valid goal_id
          .map(rating => {
            // Calculate progress_percentage from manager_achieved_value
            let progressPercentage = null;
            if (rating.manager_achieved_value !== null && rating.manager_achieved_value !== undefined) {
              const kpi = relevantKpis.find((k: any) => k.id === rating.goal_id);
              if (kpi && kpi.target_value) {
                const numericTarget = parseNumericTarget(kpi.target_value);
                if (numericTarget && numericTarget > 0) {
                  progressPercentage = Math.round((rating.manager_achieved_value / numericTarget) * 100);
                }
              }
            }
            
            return {
              goal_id: rating.goal_id,
              rating: rating.rating ?? null,
              comments: rating.comments ?? '',
              progress_percentage: progressPercentage ?? rating.progress_percentage ?? null,
            };
          });

        if (ratingsToSave.length > 0) {
          await evaluationService.kpiManagerFeedback.bulkUpsert(mgrReviewResult.data.id, ratingsToSave);
        } else {
          console.warn('No ratings to save - goalManagerRatings might be empty');
        }
      }

      toast({ title: 'Progress saved' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [activeCycle, managerId, employeeId, selectedQuarter, evaluationMode, overallRating, overallComments, yearEndOverallComments, potentialRating, developmentRecommendations, goalManagerRatings, calculatedQuarterRating, kpis, toast, transition, managerRole, nestedTab]);

  const handleNext = useCallback(async () => {
    // Save current progress before navigating to ensure data persistence
    await handleSave();
    // Navigate to overall assessment tab
    setEvaluationTab('overall');
  }, [handleSave]);

  // Handle KRA/KPI rejection
  const handleRejectKraKpi = useCallback((type: 'kra' | 'kpi', id: string, title: string) => {
    setRejectingItem({ type, id, title });
    setRejectionReason('');
    setRejectionDialogOpen(true);
  }, []);

  const handleConfirmRejection = useCallback(async () => {
    if (!rejectingItem || !rejectionReason.trim() || !activeCycle || !employeeId || !managerId) {
      toast({
        title: 'Error',
        description: !rejectionReason.trim() ? 'Please provide a rejection reason' : 'Missing required information',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // If manager evaluation doesn't exist, create it first
      let currentManagerEvaluation = managerEvaluation;
      if (!currentManagerEvaluation?.id) {
        // Get transition info if applicable
        let periodType: 'full_quarter' | 'pre_transition' | 'post_transition' | null = null;
        let transitionId: string | null = null;
        let periodStartDate: string | undefined = undefined;
        let periodEndDate: string | undefined = undefined;

        if (transition && transition.quarter === selectedQuarter) {
          transitionId = transition.id;
          
          if (managerRole === 'new_manager') {
            // New manager always reviews post-transition
            periodType = 'post_transition';
            periodStartDate = transition.post_period_start_date || undefined;
            periodEndDate = transition.post_period_end_date || undefined;
          } else if (managerRole === 'old_manager') {
            // Old manager always reviews pre-transition
            periodType = 'pre_transition';
            periodStartDate = transition.pre_period_start_date || undefined;
            periodEndDate = transition.pre_period_end_date || undefined;
          } else if (managerRole === 'same_manager' || !managerRole) {
            // Same manager reviews based on which nested tab is active
            if (nestedTab === 'transition') {
              // Transition tab = post-transition
              periodType = 'post_transition';
              periodStartDate = transition.post_period_start_date || undefined;
              periodEndDate = transition.post_period_end_date || undefined;
            } else {
              // Pre-transition tab = pre-transition
              periodType = 'pre_transition';
              periodStartDate = transition.pre_period_start_date || undefined;
              periodEndDate = transition.pre_period_end_date || undefined;
            }
          }
        }

        // Create manager review
        const createReviewResult = await evaluationService.managerReviews.upsert({
          employee_id: employeeId,
          cycle_id: activeCycle.id,
          quarter: selectedQuarter,
          reviewer_id: managerId,
          overall_comments: '',
          guidance: '',
          calculated_overall_rating: null,
          status: 'in_progress',
          period_type: periodType,
          transition_id: transitionId,
          period_start_date: periodStartDate,
          period_end_date: periodEndDate,
        });

        if (createReviewResult.data) {
          currentManagerEvaluation = createReviewResult.data;
          setManagerEvaluation(createReviewResult.data);
        } else {
          throw new Error('Failed to create manager review');
        }
      }

      await evaluationService.kraKpiRejections.reject({
        manager_review_id: currentManagerEvaluation.id,
        [rejectingItem.type === 'kra' ? 'kra_id' : 'goal_id']: rejectingItem.id,
        rejection_reason: rejectionReason.trim(),
        quarter: selectedQuarter,
        cycle_id: activeCycle.id,
        employee_id: employeeId,
      });

      toast({
        title: 'Rejection submitted',
        description: `The ${rejectingItem.type.toUpperCase()} has been rejected and sent back to the employee.`,
      });

      // Refresh rejections and manager evaluation
      const rejectionsResult = await evaluationService.kraKpiRejections.get({
        manager_review_id: currentManagerEvaluation.id,
        employee_id: employeeId,
        cycle_id: activeCycle.id,
        quarter: selectedQuarter,
      });
      
      const rejectionsMap: Record<string, any> = {};
      (rejectionsResult.data || []).forEach((rejection: any) => {
        const key = rejection.kra_id || rejection.goal_id;
        if (key) {
          rejectionsMap[key] = rejection;
        }
      });
      setKraKpiRejections(rejectionsMap);

      // Refresh manager evaluation to get updated status
      const mgrReviewResult = await evaluationService.managerReviews.getByQuarter(
        employeeId,
        activeCycle.id,
        selectedQuarter,
        currentManagerEvaluation.period_type,
        currentManagerEvaluation.transition_id
      );
      if (mgrReviewResult.data) {
        setManagerEvaluation(mgrReviewResult.data);
      }

      setRejectionDialogOpen(false);
      setRejectingItem(null);
      setRejectionReason('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject KRA/KPI',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [rejectingItem, rejectionReason, managerEvaluation, activeCycle, employeeId, selectedQuarter, managerId, transition, managerRole, nestedTab, quarterlyCycles, toast]);

  const handleTabChange = useCallback((value: string) => {
    setEvaluationTab(value);
  }, []);

  const handleSubmit = useCallback(async () => {
    // For year-end evaluation, handle differently
    if (evaluationMode === 'year-end') {
      // Check for overall rating (required)
      if (!overallRating) {
        toast({
          title: 'Rating required',
          description: 'Please select an overall rating before submitting year-end evaluation',
          variant: 'destructive',
        });
        return;
      }

      // Check for overall feedback (required)
      if (!yearEndOverallComments.trim()) {
        toast({
          title: 'Feedback required',
          description: 'Please provide overall feedback before submitting year-end evaluation',
          variant: 'destructive',
        });
        return;
      }

      // Check quarterly ratings
      const hasQuarterlyRatings = Object.values(quarterlyRatings).some(r => r !== null);
      if (!hasQuarterlyRatings) {
        toast({
          title: 'No quarterly ratings',
          description: 'At least one quarterly review must be completed before year-end evaluation',
          variant: 'destructive',
        });
        return;
      }

      if (!activeCycle || !managerId || !employeeId) return;

      setSaving(true);
      try {
        // Submit year-end evaluation
        const result = await evaluationService.yearEndEvaluation.upsert({
          employee_id: employeeId,
          cycle_id: activeCycle.id,
          evaluator_id: managerId,
          overall_rating: overallRating,
          overall_comments: yearEndOverallComments,
          potential_rating: potentialRating,
          status: 'submitted',
        });

        // Update the local state
        if (result.data) {
          setYearEndManagerEvaluation(result.data);
        }

        toast({ title: 'Year-end evaluation submitted successfully' });
        navigate('/team');
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
      return;
    }


    const missingRatings = quarterKpis.filter((g) => !goalManagerRatings[g.id]?.rating);
    if (missingRatings.length > 0) {
      toast({
        title: 'Incomplete ratings',
        description: 'Please rate all KPIs before submitting',
        variant: 'destructive',
      });
      return;
    }

    // Check for missing comments (comments are required)
    const missingComments = quarterKpis.filter((g) => !goalManagerRatings[g.id]?.comments?.trim());
    if (missingComments.length > 0) {
      toast({
        title: 'Comments required',
        description: `Please provide comments for all KPIs (${missingComments.length} missing)`,
        variant: 'destructive',
      });
      return;
    }

    if (!activeCycle || !managerId || !employeeId) return;

    setSaving(true);
    try {
      // Determine period_type and transition_id for transition employees
      let periodType: 'full_quarter' | 'pre_transition' | 'post_transition' | undefined = undefined;
      let transitionId: string | undefined = undefined;
      let periodStartDate: string | undefined = undefined;
      let periodEndDate: string | undefined = undefined;
      
      if (transition && transition.quarter === selectedQuarter) {
        transitionId = transition.id;
        
        // Determine period type based on manager role and nested tab
        if (managerRole === 'new_manager') {
          // New manager always reviews post-transition
          periodType = 'post_transition';
          periodStartDate = transition.post_period_start_date || undefined;
          periodEndDate = transition.post_period_end_date || undefined;
        } else if (managerRole === 'old_manager') {
          // Old manager always reviews pre-transition
          periodType = 'pre_transition';
          periodStartDate = transition.pre_period_start_date || undefined;
          periodEndDate = transition.pre_period_end_date || undefined;
        } else if (managerRole === 'same_manager') {
          // Same manager reviews based on which nested tab is active
          if (nestedTab === 'transition') {
            // Transition tab = post-transition
            periodType = 'post_transition';
            periodStartDate = transition.post_period_start_date || undefined;
            periodEndDate = transition.post_period_end_date || undefined;
          } else {
            // Pre-transition tab = pre-transition
            periodType = 'pre_transition';
            periodStartDate = transition.pre_period_start_date || undefined;
            periodEndDate = transition.pre_period_end_date || undefined;
          }
        }
      }
      
      const mgrReviewResult = await evaluationService.managerReviews.upsert({
        employee_id: employeeId,
        cycle_id: activeCycle.id,
        quarter: selectedQuarter,
        reviewer_id: managerId,
        overall_comments: overallComments,
        guidance: developmentRecommendations,
        calculated_overall_rating: calculatedQuarterRating,
        status: 'submitted',
        period_type: periodType,
        transition_id: transitionId,
        period_start_date: periodStartDate,
        period_end_date: periodEndDate,
      });

      if (mgrReviewResult.data) {
        // Update managerEvaluation state with submitted review
        setManagerEvaluation(mgrReviewResult.data);
        
        // Save KPI manager feedback
        const ratingsToSave = Object.values(goalManagerRatings).map(rating => {
          // Calculate progress_percentage from manager_achieved_value
          let progressPercentage = null;
          if (rating.manager_achieved_value !== null && rating.manager_achieved_value !== undefined) {
            const kpi = kpis.find((k: any) => k.id === rating.goal_id);
            if (kpi && kpi.target_value) {
              const numericTarget = parseNumericTarget(kpi.target_value);
              if (numericTarget && numericTarget > 0) {
                progressPercentage = Math.round((rating.manager_achieved_value / numericTarget) * 100);
              }
            }
          }
          
          return {
          goal_id: rating.goal_id,
          rating: rating.rating,
          comments: rating.comments,
            progress_percentage: progressPercentage ?? rating.progress_percentage ?? null,
          };
        });

        if (ratingsToSave.length > 0) {
          await evaluationService.kpiManagerFeedback.bulkUpsert(mgrReviewResult.data.id, ratingsToSave);
        }
      }

      toast({ title: `Q${selectedQuarter} Manager review submitted` });
      // Don't navigate away - let the user see the submitted state
      // The buttons will be hidden because isSubmitted will be true
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [activeCycle, managerId, employeeId, goalManagerRatings, quarterKpis, kpis, overallComments, yearEndOverallComments, developmentRecommendations, overallRating, potentialRating, evaluationMode, selectedQuarter, quarterlyRatings, calculatedQuarterRating, calculatedYearEndRating, transition, managerRole, toast]);

  const getRatingLabel = (value: number | null) => {
    if (!value) return 'Not rated';
    const scale = ratingScales.find((s) => s.value === value);
    return scale ? `${value} - ${scale.name}` : value.toString();
  };

  const fetchHrReviewRatings = useCallback(async () => {
    if (!activeCycle || !managerId || !selectedQuarter) return;
    
    setHrReviewLoading(true);
    try {
      const result = await evaluationService.normalization.getManagerRatings(
        managerId,
        selectedQuarter,
        activeCycle.id
      );
      // Filter to show only the specific employee being evaluated
      const filteredRatings = (result.data || []).filter(
        (rating: any) => rating.employee_id === employeeId
      );
      setHrReviewRatings(filteredRatings);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load HR review ratings',
        variant: 'destructive',
      });
    } finally {
      setHrReviewLoading(false);
    }
  }, [activeCycle, managerId, selectedQuarter, employeeId, toast]);

  const handleManagerReview = useCallback(async (employeeId: string, action: 'ACCEPT' | 'REJECT') => {
    if (!activeCycle || !selectedQuarter) return;
    
    try {
      await evaluationService.normalization.managerReview(employeeId, selectedQuarter, activeCycle.id, action);
      toast({
        title: 'Success',
        description: `Rating ${action === 'ACCEPT' ? 'accepted' : 'rejected'}`,
      });
      await fetchHrReviewRatings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${action.toLowerCase()} rating`,
        variant: 'destructive',
      });
    }
  }, [activeCycle, selectedQuarter, toast, fetchHrReviewRatings]);

  // Helper function to render KRA card - MUST be defined before early returns (React Rules of Hooks)
  const renderKRACard = useCallback((kra: any, kraKpis: any[], relevantGoalSelfRatings: Record<string, GoalSelfRating>, isSubmitted: boolean, quarter: number) => {
    const isExpanded = expandedKRAs.has(kra.id);
    return (
      <Card key={kra.id} className="border-l-4 border-l-card-border">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 mt-1"
              onClick={() => toggleKRA(kra.id)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-[hsl(var(--card-arrow))]" /> : <ChevronRight className="h-4 w-4 text-[hsl(var(--card-arrow))]" />}
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-primary/10">
                  KRA
                </Badge>
                <span className="text-sm font-medium text-primary">Weight: {kra.weight}%</span>
              </div>
              <CardTitle className="text-lg">{kra.title}</CardTitle>
              {kra.description && <CardDescription className="mt-1">{kra.description}</CardDescription>}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calculator className="h-3 w-3" />
                KRA Rating
              </div>
              <div className="text-xl font-bold text-primary">
                {formatRating(calculatedKRARatings[kra.id])}
              </div>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4">
            {kraKpis.map((kpi) => (
              <div key={kpi.id} className="border rounded-lg p-4 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary">KPI</Badge>
                    <span className="text-sm text-muted-foreground">Weight: {kpi.weight}%</span>
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

                {relevantGoalSelfRatings[kpi.id] && (
                  <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                    <h5 className="font-medium text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Employee Self Assessment
                    </h5>
                    <div className="grid gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Self Rating: </span>
                        <Badge variant="secondary">
                          {getRatingLabel(relevantGoalSelfRatings[kpi.id].self_rating)}
                        </Badge>
                      </div>
                      {relevantGoalSelfRatings[kpi.id].achievement && (
                        <div>
                          <span className="text-muted-foreground">Achievement: </span>
                          <p className="mt-1">{relevantGoalSelfRatings[kpi.id].achievement}</p>
                        </div>
                      )}
                      {(() => {
                        const evidence = relevantGoalSelfRatings[kpi.id]?.evidence;

                        // Show evidence if it exists and is not empty string
                        if (evidence && evidence.trim() !== '') {
                          return (
                            <KPIEvidenceView
                              evidence={evidence}
                              goalId={kpi.id}
                              employeeId={employeeId}
                              quarter={quarter}
                            />
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}

                {(() => {
                  const numericTarget = parseNumericTarget(kpi.target_value);
                  const selfRating = relevantGoalSelfRatings[kpi.id];
                  if (numericTarget !== null) {
                    const employeeAchieved = selfRating?.achieved_value ?? 0;
                    const managerAchieved = goalManagerRatings[kpi.id]?.manager_achieved_value ?? employeeAchieved;
                    return (
                      <DualAchievementSlider
                        calibration={kpi.calibration}
                        targetValue={numericTarget}
                        employeeAchieved={employeeAchieved}
                        managerAchieved={managerAchieved}
                        onManagerChange={(value) => handleGoalRatingChange(kpi.id, 'manager_achieved_value' as keyof GoalManagerRating, value)}
                        onRatingChange={(rating) => handleGoalRatingChange(kpi.id, 'rating', rating)}
                        disabled={isSubmitted}
                        metricType={kpi.metric_type || relevantGoalSelfRatings[kpi.id]?.metric_type}
                      />
                    );
                  }
                  return null;
                })()}

                {kpi.calibration && kpi.calibration.length > 0 && (
                  <CalibrationDisplay
                    calibration={kpi.calibration}
                    targetValue={kpi.target_value}
                    achievedValue={goalManagerRatings[kpi.id]?.manager_achieved_value ?? relevantGoalSelfRatings[kpi.id]?.achieved_value ?? null}
                    metricType={kpi.metric_type || relevantGoalSelfRatings[kpi.id]?.metric_type || "number"}
                    className="mt-4"
                  />
                )}

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-sm">Your Rating</h5>
                  </div>

                  <div className="space-y-2">
                    <Label>Rating *</Label>
                    <RadioGroup
                      value={goalManagerRatings[kpi.id]?.rating?.toString() || ''}
                      onValueChange={(value) => handleGoalRatingChange(kpi.id, 'rating', parseInt(value))}
                      disabled={isSubmitted}
                      className="flex flex-wrap gap-4"
                    >
                      {ratingScales.map((scale) => (
                        <div key={scale.value} className="flex items-center space-x-2">
                          <RadioGroupItem
                            value={scale.value.toString()}
                            id={`mgr-${kpi.id}-${scale.value}`}
                            disabled={isSubmitted}
                          />
                          <Label
                            htmlFor={`mgr-${kpi.id}-${scale.value}`}
                            className={`flex items-center gap-1 ${isSubmitted ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                          >
                            <Star className="h-4 w-4" style={{ color: scale.color || undefined }} />
                            {scale.value} - {scale.name}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Comments</Label>
                    <Textarea
                      value={goalManagerRatings[kpi.id]?.comments || ''}
                      onChange={(e) => handleGoalRatingChange(kpi.id, 'comments', e.target.value)}
                      disabled={isSubmitted}
                      placeholder="Add your comments about this KPI..."
                      rows={3}
                    />
                  </div>

                  {/* Reject Button */}
                  {/* Reject Button - will automatically create manager review if needed */}
                  <div className="flex justify-end pt-2 border-t">
                    {(() => {
                      const rejection = kraKpiRejections[kpi.id];
                      const isRejected = rejection && !rejection.resubmitted_at;
                      const canReject = !isRejected; // Can only reject if not already rejected
                      
                      return (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRejectKraKpi('kpi', kpi.id, kpi.title)}
                          disabled={!canReject || saving}
                          aria-label={`Reject KPI: ${kpi.title}`}
                          title={isRejected ? 'This KPI has already been rejected' : 'Reject this KPI'}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          {isRejected ? 'Already Rejected' : 'Reject KPI'}
                        </Button>
                      );
                    })()}
                  </div>

                  {/* Show rejection feedback if rejected */}
                  {(() => {
                    const rejection = kraKpiRejections[kpi.id];
                    if (rejection && !rejection.resubmitted_at) {
                      return (
                        <Alert className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="font-medium mb-1">Rejected by Manager</div>
                            <div className="text-sm">{rejection.rejection_reason}</div>
                          </AlertDescription>
                        </Alert>
                      );
                    }
                    if (rejection && rejection.resubmitted_at) {
                      return (
                        <Alert className="mt-2">
                          <CheckCircle2 className="h-4 w-4" />
                          <AlertDescription>
                            <div className="font-medium mb-1">Resubmitted by Employee</div>
                            <div className="text-sm">Previously rejected, now resubmitted for review.</div>
                          </AlertDescription>
                        </Alert>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    );
  }, [expandedKRAs, toggleKRA, calculatedKRARatings, goalManagerRatings, handleGoalRatingChange, ratingScales, getRatingLabel, managerEvaluation, kraKpiRejections, handleRejectKraKpi, saving]);

  // ALL HOOKS AND COMPUTED VALUES MUST BE CALLED BEFORE ANY EARLY RETURNS
  // This ensures React Rules of Hooks are followed (hooks must be called in the same order every render)
  
  const quarterNumber = evaluationMode === 'quarterly' ? selectedQuarter : null;

  // Get the appropriate self-eval based on quarterly or year-end view
  // For transition employees, get the period-specific self-eval based on nestedTab
  const relevantSelfEval = useMemo(() => {
    if (!quarterNumber) {
      return selfEvaluation;
    }
    
    // For transition employees, we need to get the correct period-specific self-eval
    if (transition && transition.quarter === selectedQuarter) {
      // Check if we have separate pre and post-transition reviews stored
      // For same_manager, we need to get the one matching the active nestedTab
      if (managerRole === 'same_manager' || !managerRole) {
        // Fetch all self-reviews for the quarter to find the correct one
        // The quarterlySelfEvals should already have the correct one based on nestedTab from fetchData
        // But we need to ensure it matches the active tab
        const allSelfEvals = Object.values(quarterlySelfEvals).filter((e: any) => 
          e.quarter === quarterNumber && 
          e.transition_id === transition.id
        );
        
        if (isTransitionTab) {
          // Transition tab: find post-transition self-eval
          const postTransitionEval = allSelfEvals.find((e: any) => e.period_type === 'post_transition');
          if (postTransitionEval) {
            return postTransitionEval;
          }
        } else {
          // Pre-transition tab: find pre-transition self-eval
          const preTransitionEval = allSelfEvals.find((e: any) => e.period_type === 'pre_transition');
          if (preTransitionEval) {
            return preTransitionEval;
          }
        }
      }
      
      // For old_manager or new_manager, or if we didn't find a period-specific one, use the one from quarterlySelfEvals
      return quarterlySelfEvals[quarterNumber] || selfEvaluation;
    }
    
    // No transition: use the regular self-eval
    return quarterlySelfEvals[quarterNumber] || selfEvaluation;
  }, [quarterNumber, quarterlySelfEvals, selfEvaluation, transition, selectedQuarter, managerRole, isTransitionTab]);

  // Compute displayed KPIs based on manager role, transition, and nested tab (for filtering ratings)
  const displayedKpis = useMemo(() => {
    if (!transition || transition.quarter !== selectedQuarter || !quarterNumber) {
      // No transition, return all quarter KPIs
      return quarterKpis;
    }
    
    // Filter KPIs by period_type and transition_id (same logic as in renderQuarterlyRatingContent)
    const transitionIdStr = String(transition.id);
    const preTransitionKpis = quarterKpis.filter(k => {
      // Include if:
      // 1. transition_id IS NULL (old goals)
      // 2. period_type = 'full_quarter' (fallback)
      // 3. period_type = 'pre_transition' AND transition_id matches
      if (!k.transition_id) {
        return true;
      }
      if (k.period_type === 'full_quarter') {
        return true;
      }
      return k.period_type === 'pre_transition' && String(k.transition_id) === transitionIdStr;
    });
    const postTransitionKpis = quarterKpis.filter(k => {
      // Only show post-transition goals with matching transition_id
      const periodMatch = k.period_type === 'post_transition';
      const transitionMatch = k.transition_id ? String(k.transition_id) === transitionIdStr : false;
      return periodMatch && transitionMatch;
    });
    
    console.log('[ManagerEvaluation] Computing displayed KPIs:', {
      managerRole,
      nestedTab,
      transitionId: transition.id,
      quarter: selectedQuarter,
      allQuarterKpis: quarterKpis.length,
      preTransitionKpis: preTransitionKpis.length,
      postTransitionKpis: postTransitionKpis.length,
      preTransitionKpiIds: preTransitionKpis.map(k => k.id),
      postTransitionKpiIds: postTransitionKpis.map(k => k.id)
    });
    
    // Apply manager role and nested tab filtering
    if (managerRole === 'old_manager') {
      // Old manager: only pre-transition (always show pre-transition tab)
      return preTransitionKpis;
    } else if (managerRole === 'new_manager') {
      // New manager: only post-transition (always show transition tab)
      return postTransitionKpis;
    } else if (managerRole === 'same_manager') {
      // Same manager: filter based on nested tab
      if (isTransitionTab) {
        return postTransitionKpis;
      } else {
        return preTransitionKpis;
      }
    }
    
    // No manager role or no transition: return all quarter KPIs
    return quarterKpis;
  }, [transition, selectedQuarter, quarterNumber, quarterKpis, managerRole, nestedTab, isTransitionTab]);

  // Get the appropriate goal self ratings based on quarterly or year-end view
  // For transition employees, get ratings from the correct period-specific self-review
  const relevantGoalSelfRatings = useMemo(() => {
    if (!quarterNumber) {
      return goalSelfRatings;
    }
    
    // For transition employees, we need to get ratings from the correct period-specific self-review
    if (transition && transition.quarter === selectedQuarter) {
      // Get the self-eval for the active tab
      const activeSelfEval = relevantSelfEval;
      
      if (activeSelfEval && activeSelfEval.id) {
        // The ratings should already be fetched in fetchData for the correct self-review
        // But quarterlyGoalSelfRatings[quarterNumber] might have ratings from the wrong period
        // We need to ensure we're using ratings that match the active self-eval's period_type
        
        // Use the ratings from quarterlyGoalSelfRatings (which should match the active self-eval)
        // and filter by displayed KPIs to ensure we only show ratings for the correct period
        const baseRatings = quarterlyGoalSelfRatings[quarterNumber] || {};
        
        // Get the KPIs that are being displayed (filtered by manager role and nestedTab)
        const displayedKpiIds = new Set(displayedKpis.map(kpi => kpi.id));
        
        // Filter ratings to only include those for displayed KPIs
        const filteredRatings: Record<string, GoalSelfRating> = {};
        Object.entries(baseRatings).forEach(([kpiId, rating]) => {
          if (displayedKpiIds.has(kpiId)) {
            filteredRatings[kpiId] = rating;
          }
        });
        
        console.log('[ManagerEvaluation] Filtered goal self ratings for transition tab:', {
          activeSelfEval: activeSelfEval ? { id: activeSelfEval.id, period_type: activeSelfEval.period_type, transition_id: activeSelfEval.transition_id } : null,
          nestedTab,
          isTransitionTab,
          baseRatingsCount: Object.keys(baseRatings).length,
          displayedKpiIds: Array.from(displayedKpiIds),
          displayedKpisCount: displayedKpis.length,
          displayedKpis: displayedKpis.map(k => ({ id: k.id, title: k.title, period_type: k.period_type, transition_id: k.transition_id })),
          filteredRatingsCount: Object.keys(filteredRatings).length,
          filteredRatings
        });
        
        return filteredRatings;
      } else {
        // No active self-eval found - return empty ratings
        console.log('[ManagerEvaluation] No active self-eval found for transition tab:', {
          nestedTab,
          isTransitionTab,
          transition,
          selectedQuarter,
          quarterlySelfEvals: quarterlySelfEvals[quarterNumber]
        });
        return {};
      }
    }
    
    // No transition: use regular ratings
    const baseRatings = quarterlyGoalSelfRatings[quarterNumber] || {};
    return baseRatings;
  }, [quarterNumber, quarterlyGoalSelfRatings, goalSelfRatings, transition, selectedQuarter, displayedKpis, relevantSelfEval, nestedTab, isTransitionTab, quarterlySelfEvals]);

  // These are computed after null checks, but add safety checks just in case
  const quarterPeriodStatus = activeCycle 
    ? getQuarterManagerReviewStatus(activeCycle, selectedQuarter, quarterlyCycles)
    : { timing: 'future' as const, startDate: null, endDate: null, message: 'No active performance cycle.' };
  const yearEndPeriodStatus = activeCycle 
    ? getYearEndManagerEvalStatus(activeCycle)
    : { timing: 'future' as const, startDate: null, endDate: null, message: 'No active performance cycle.' };
  
  // Check if employee has transition for this quarter
  const hasTransitionForQuarter = transition && transition.employee_id === employeeId;
  
  // Helper to check if current date is within quarter date range
  // NOTE: This hook must be called before any early returns to comply with React Rules of Hooks
  const isWithinQuarterDates = useMemo(() => {
    if (!activeCycle || !quarterlyCycles) return false;
    
    // Find the quarterly cycle for this quarter
    const quarterlyCycle = quarterlyCycles.find(qc => qc.quarter === selectedQuarter);
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
  }, [activeCycle, quarterlyCycles, selectedQuarter]);

  // Reset nested tab when quarter changes or when transition changes
  // IMPORTANT: This hook must be called BEFORE any early returns to comply with React Rules of Hooks
  useEffect(() => {
    if (transition && transition.quarter === selectedQuarter) {
      // If manager is new_manager, default to transition tab, otherwise pre-transition
      if (managerRole === 'new_manager') {
        setNestedTab('transition');
      } else {
        setNestedTab('pre-transition');
      }
    } else {
      setNestedTab('pre-transition');
    }
  }, [selectedQuarter, transition, managerRole]);

  // Ensure manager ratings are initialized for all displayed KPIs when nestedTab changes
  // This is especially important for transition employees when switching between pre-transition and transition tabs
  useEffect(() => {
    if (transition && transition.quarter === selectedQuarter && displayedKpis.length > 0) {
      setGoalManagerRatings((prev) => {
        const updated = { ...prev };
        let hasChanges = false;
        
        // Initialize ratings for any displayed KPIs that don't have ratings yet
        displayedKpis.forEach((kpi) => {
          if (!updated[kpi.id]) {
            updated[kpi.id] = {
              goal_id: kpi.id,
              rating: null,
              comments: '',
              manager_achieved_value: null,
              progress_percentage: null,
            };
            hasChanges = true;
          }
        });
        
        // Remove ratings for KPIs that are no longer displayed (when switching tabs)
        Object.keys(updated).forEach((kpiId) => {
          if (!displayedKpis.find((kpi) => kpi.id === kpiId)) {
            delete updated[kpiId];
            hasChanges = true;
          }
        });
        
        if (hasChanges) {
          console.log('[ManagerEvaluation] Updated manager ratings based on displayed KPIs:', {
            nestedTab,
            isTransitionTab,
            displayedKpiIds: displayedKpis.map(k => k.id),
            updatedKpiIds: Object.keys(updated)
          });
        }
        
        return updated;
      });
    }
  }, [displayedKpis, transition, selectedQuarter, nestedTab, isTransitionTab]);

  // Early returns must come AFTER all hooks
  // Show loading state while fetching or if active cycle is still loading
  if (loading || isLoadingActiveCycle) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!managerId || !employee) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Unable to load evaluation data. Please try again.</AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  if (!activeCycle || !activeCycle.id) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No active performance cycle. Please contact HR.</AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  // Early returns must come AFTER all hooks
  if (kras.length === 0 || kpis.length === 0) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => navigate('/team')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Team
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">No approved KRAs/KPIs</h3>
              <p className="text-muted-foreground">
                {getEmployeeFirstName(employee)} does not have approved KRAs/KPIs for evaluation
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }
  
  const handleEvaluationTabChange = (tab: 'quarterly' | 'year-end', quarter?: Quarter) => {
    setEvaluationMode(tab);
    if (quarter) {
      setSelectedQuarter(quarter);
      setSearchParams({ quarter: quarter.toString() });
    } else {
      setSearchParams({});
    }
  };

  const handleQuarterChange = (quarter: Quarter) => {
    setSelectedQuarter(quarter);
    setSearchParams({ quarter: quarter.toString() });
    // Reset nested tab to pre-transition when quarter changes
    setNestedTab('pre-transition');
    // Refetch data when quarter changes to ensure we have the correct data for the selected quarter
    fetchData();
  };

  // Allow evaluation if:
  // 1. Normal case: manager review period is current AND self-eval is submitted
  // 2. Transition case: has transition AND within quarter dates AND self-eval is submitted (bypass manager review date restrictions)
  // 3. Late permission case: manager has late permission AND self-eval is submitted (bypass deadline restrictions)
  const canEvaluate = evaluationMode === 'quarterly'
    ? (hasTransitionForQuarter && isWithinQuarterDates 
        ? relevantSelfEval?.status === 'submitted'  // For transitions, only check self-eval status, bypass date restrictions
        : (quarterPeriodStatus.timing === 'current' || hasLatePermission) && relevantSelfEval?.status === 'submitted')  // Normal case: check period OR late permission
    : true;

  // Debug logging for canEvaluate
  console.log('[canEvaluate Debug]', {
    evaluationMode,
    hasTransitionForQuarter,
    isWithinQuarterDates,
    quarterPeriodStatus: quarterPeriodStatus.timing,
    hasLatePermission,
    relevantSelfEvalStatus: relevantSelfEval?.status,
    canEvaluate
  });

  // For transition employees, check submission status based on which period is being viewed
  // If viewing pre-transition KPIs and pre-transition review is submitted, hide buttons
  // If viewing post-transition KPIs and post-transition review is submitted, hide buttons
  // Determine which period's review to check based on manager role and displayed KPIs
  const isSubmitted = evaluationMode === 'quarterly' 
    ? (() => {
        if (transition && transition.quarter === selectedQuarter) {
          // Determine which period is being viewed based on manager role
          // Old manager views pre-transition, new manager views post-transition
          console.log(`[ManagerEvaluation] Checking isSubmitted for transition employee:`, {
            managerRole,
            selectedQuarter,
            transitionId: transition.id,
            preTransitionReview: preTransitionReview ? { 
              id: preTransitionReview.id, 
              status: preTransitionReview.status,
              period_type: preTransitionReview.period_type,
              transition_id: preTransitionReview.transition_id
            } : null,
            postTransitionReview: postTransitionReview ? { 
              id: postTransitionReview.id, 
              status: postTransitionReview.status,
              period_type: postTransitionReview.period_type,
              transition_id: postTransitionReview.transition_id
            } : null,
            managerEvaluation: managerEvaluation ? { 
              id: managerEvaluation.id, 
              status: managerEvaluation.status, 
              period_type: managerEvaluation.period_type,
              transition_id: managerEvaluation.transition_id
            } : null,
          });
          
          if (managerRole === 'old_manager') {
            // Old manager: check if pre-transition review is submitted
            // Must match the transition_id to ensure it's for this specific transition
            // Use preTransitionReview if available, otherwise fallback to managerEvaluation if it's pre_transition
            let review = preTransitionReview && preTransitionReview.transition_id === transition.id 
              ? preTransitionReview 
              : null;
            
            // Fallback: if preTransitionReview is null but managerEvaluation is pre_transition, use it
            if (!review && managerEvaluation && managerEvaluation.period_type === 'pre_transition' && managerEvaluation.transition_id === transition.id) {
              review = managerEvaluation;
              console.log(`[ManagerEvaluation] Using managerEvaluation as pre-transition review for old manager`);
            }
            
            const submitted = review?.status === 'submitted';
            console.log(`[ManagerEvaluation] Old manager - isSubmitted: ${submitted}`, {
              reviewExists: !!review,
              reviewStatus: review?.status,
              reviewPeriodType: review?.period_type,
              reviewTransitionId: review?.transition_id,
              expectedTransitionId: transition.id,
              usingFallback: !preTransitionReview && !!managerEvaluation
            });
            return submitted;
          } else if (managerRole === 'new_manager') {
            // New manager: check if post-transition review is submitted
            // Must match the transition_id to ensure it's for this specific transition
            // Use postTransitionReview if available, otherwise fallback to managerEvaluation if it's post_transition
            let review = postTransitionReview && postTransitionReview.transition_id === transition.id 
              ? postTransitionReview 
              : null;
            
            // Fallback: if postTransitionReview is null but managerEvaluation is post_transition, use it
            if (!review && managerEvaluation && managerEvaluation.period_type === 'post_transition' && managerEvaluation.transition_id === transition.id) {
              review = managerEvaluation;
              console.log(`[ManagerEvaluation] Using managerEvaluation as post-transition review for new manager`);
            }
            
            const submitted = review?.status === 'submitted';
            console.log(`[ManagerEvaluation] New manager - isSubmitted: ${submitted}`, {
              reviewExists: !!review,
              reviewStatus: review?.status,
              reviewPeriodType: review?.period_type,
              reviewTransitionId: review?.transition_id,
              expectedTransitionId: transition.id,
              usingFallback: !postTransitionReview && !!managerEvaluation
            });
            return submitted;
          } else if (managerRole === 'same_manager') {
            // Same manager: check the review for the active nestedTab
            // If transition tab is selected, check post-transition review
            // If pre-transition tab is selected, check pre-transition review
            let review: any = null;
            
            if (isTransitionTab) {
              // Transition tab selected: check post-transition review
              review = postTransitionReview && postTransitionReview.transition_id === transition.id
                ? postTransitionReview
                : null;
              
              // Fallback: if postTransitionReview is null but managerEvaluation is post_transition, use it
              if (!review && managerEvaluation && managerEvaluation.period_type === 'post_transition' && managerEvaluation.transition_id === transition.id) {
                review = managerEvaluation;
                console.log(`[ManagerEvaluation] Using managerEvaluation as post-transition review for same manager (transition tab)`);
              }
            } else {
              // Pre-transition tab selected: check pre-transition review
              review = preTransitionReview && preTransitionReview.transition_id === transition.id
                ? preTransitionReview
                : null;
              
              // Fallback: if preTransitionReview is null but managerEvaluation is pre_transition, use it
              if (!review && managerEvaluation && managerEvaluation.period_type === 'pre_transition' && managerEvaluation.transition_id === transition.id) {
                review = managerEvaluation;
                console.log(`[ManagerEvaluation] Using managerEvaluation as pre-transition review for same manager (pre-transition tab)`);
              }
            }
            
            const submitted = review?.status === 'submitted';
            console.log(`[ManagerEvaluation] Same manager - isSubmitted: ${submitted}`, {
              nestedTab,
              isTransitionTab,
              reviewExists: !!review,
              reviewStatus: review?.status,
              reviewPeriodType: review?.period_type,
              reviewTransitionId: review?.transition_id,
              expectedTransitionId: transition.id,
              managerEvaluationStatus: managerEvaluation?.status,
              managerEvaluationPeriodType: managerEvaluation?.period_type
            });
            return submitted;
          }
          // Fallback to managerEvaluation status
          const submitted = managerEvaluation?.status === 'submitted';
          console.log(`[ManagerEvaluation] Fallback - isSubmitted: ${submitted}`, {
            managerEvaluationStatus: managerEvaluation?.status
          });
          return submitted;
        }
        // No transition, use normal check
        const submitted = managerEvaluation?.status === 'submitted';
        console.log(`[ManagerEvaluation] No transition - isSubmitted: ${submitted}`, {
          managerEvaluationStatus: managerEvaluation?.status
        });
        return submitted;
      })()
    : Boolean(yearEndManagerEvaluation && yearEndManagerEvaluation.status === 'submitted');
  const hasHRRejection = evaluationMode === 'quarterly'
    ? managerEvaluation?.hr_rejection_reason && managerEvaluation?.status === 'pending'
    : yearEndManagerEvaluation?.hr_rejection_reason && yearEndManagerEvaluation?.status === 'pending';

  // Render KRA/KPI rating content (quarterly only)
  const renderQuarterlyRatingContent = () => {
    // Debug logging
    console.log('=== ManagerEvaluation - renderQuarterlyRatingContent ===');
    console.log('Selected Quarter:', selectedQuarter);
    console.log('Transition:', transition);
    console.log('Transition ID:', transition?.id);
    console.log('All KRAs count:', kras.length);
    console.log('All KPIs count:', kpis.length);
    console.log('Quarter KRAs count:', quarterKras.length);
    console.log('Quarter KPIs count:', quarterKpis.length);
    console.log('Quarter KRAs:', quarterKras.map(k => ({ 
      id: k.id, 
      title: k.title,
      quarter: k.quarter, 
      period_type: k.period_type, 
      transition_id: k.transition_id 
    })));
    console.log('Quarter KPIs:', quarterKpis.map(k => ({ 
      id: k.id, 
      title: k.title,
      quarter: k.quarter, 
      period_type: k.period_type, 
      transition_id: k.transition_id,
      kra_id: k.kra_id
    })));
    
    // Separate KRAs/KPIs by period if transition exists
    // For pre-transition: show goals with period_type='pre_transition' AND transition_id matches,
    // OR goals where transition_id IS NULL, OR goals with period_type='full_quarter'
    // (these are the old goals that should be shown in pre-transition)
    // For post-transition: show goals with period_type='post_transition' AND transition_id matches
    const transitionIdStr = transition && transition.id ? String(transition.id) : null;
    const preTransitionKras = transition && transition.id
      ? quarterKras.filter(k => {
          // Include if:
          // 1. transition_id IS NULL (old goals)
          // 2. period_type = 'full_quarter' (fallback)
          // 3. period_type = 'pre_transition' AND transition_id matches
          if (!k.transition_id) {
            return true;
          }
          if (k.period_type === 'full_quarter') {
            return true;
          }
          const matches = k.period_type === 'pre_transition' && String(k.transition_id) === transitionIdStr;
          return matches;
        })
      : [];
    const preTransitionKpis = transition && transition.id
      ? quarterKpis.filter(k => {
          // Include if:
          // 1. transition_id IS NULL (old goals)
          // 2. period_type = 'full_quarter' (fallback)
          // 3. period_type = 'pre_transition' AND transition_id matches
          if (!k.transition_id) {
            return true;
          }
          if (k.period_type === 'full_quarter') {
            return true;
          }
          const matches = k.period_type === 'pre_transition' && String(k.transition_id) === transitionIdStr;
          return matches;
        })
      : [];
    const postTransitionKras = transition && transition.id
      ? quarterKras.filter(k => {
          // Only show post-transition goals with matching transition_id
          const periodMatch = k.period_type === 'post_transition';
          const transitionMatch = k.transition_id ? String(k.transition_id) === transitionIdStr : false;
          const matches = periodMatch && transitionMatch;
          if (!matches && periodMatch) {
            console.log('[ManagerEvaluation] Post-transition KRA filtered out:', {
              id: k.id,
              title: k.title,
              period_type: k.period_type,
              transition_id: k.transition_id,
              expectedTransitionId: transitionIdStr,
              transitionMatch
            });
          }
          return matches;
        })
      : [];
    const postTransitionKpis = transition && transition.id
      ? quarterKpis.filter(k => {
          // Only show post-transition goals with matching transition_id
          const periodMatch = k.period_type === 'post_transition';
          const transitionMatch = k.transition_id ? String(k.transition_id) === transitionIdStr : false;
          const matches = periodMatch && transitionMatch;
          if (!matches && periodMatch) {
            console.log('[ManagerEvaluation] Post-transition KPI filtered out:', {
              id: k.id,
              title: k.title,
              period_type: k.period_type,
              transition_id: k.transition_id,
              expectedTransitionId: transitionIdStr,
              transitionMatch
            });
          }
          return matches;
        })
      : [];
    const fullQuarterKras = transition ? [] : quarterKras.filter(k => !k.period_type || k.period_type === 'full_quarter' || !k.transition_id);
    const fullQuarterKpis = transition ? [] : quarterKpis.filter(k => !k.period_type || k.period_type === 'full_quarter' || !k.transition_id);
    
    // Apply manager role filtering
    // Case 1: Different managers (old_manager_id ≠ new_manager_id)
    //   - Old manager: show only pre-transition
    //   - New manager: show only post-transition
    // Case 2: Same manager (new_manager_id is null/empty or equals old_manager_id)
    //   - Show both pre and post-transition
    let displayPreTransitionKras = preTransitionKras;
    let displayPreTransitionKpis = preTransitionKpis;
    let displayPostTransitionKras = postTransitionKras;
    let displayPostTransitionKpis = postTransitionKpis;
    
    if (transition && managerRole) {
      const managersAreDifferent = transition.new_manager_id && 
                                    transition.new_manager_id !== transition.old_manager_id;
      
      if (managersAreDifferent) {
        // Different managers: filter by role
        if (managerRole === 'old_manager') {
          // Old manager: only pre-transition
          displayPostTransitionKras = [];
          displayPostTransitionKpis = [];
        } else if (managerRole === 'new_manager') {
          // New manager: only post-transition
          displayPreTransitionKras = [];
          displayPreTransitionKpis = [];
        }
      }
      // If managerRole === 'same_manager', show both (no filtering needed)
    }
    
    console.log('Pre-transition KRAs:', preTransitionKras.length, preTransitionKras.map(k => ({ id: k.id, title: k.title })));
    console.log('Pre-transition KPIs:', preTransitionKpis.length, preTransitionKpis.map(k => ({ id: k.id, title: k.title })));
    console.log('Post-transition KRAs:', postTransitionKras.length);
    console.log('Post-transition KPIs:', postTransitionKpis.length);
    console.log('Full quarter KRAs:', fullQuarterKras.length);
    console.log('Full quarter KPIs:', fullQuarterKpis.length);
    console.log('==================================================');
    
    // Get period ratings
    const prePeriodRating = periodRatings.find(p => p.period_type === 'pre_transition');
    const postPeriodRating = periodRatings.find(p => p.period_type === 'post_transition');
    
    return (
    <div className="space-y-6">
      {/* Transition Alert */}
      {transition && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold">Mid-Quarter Transition Detected</span>
                <p className="text-sm text-muted-foreground mt-1">
                  Transition Date: {formatDateShort(new Date(transition.transition_date))} • 
                  Type: {transition.transition_type}
                  {transition.old_manager_name && transition.new_manager_name && (
                    <> • Old Manager: {transition.old_manager_name} → New Manager: {transition.new_manager_name}</>
                  )}
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
      
      {/* Period Ratings Display - Only show ratings for periods the manager can see */}
      {transition && (prePeriodRating || postPeriodRating || finalRating) && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg">Period Ratings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Pre-transition rating - only show if manager should see pre-transition */}
              {prePeriodRating && (managerRole === 'old_manager' || managerRole === 'same_manager') && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Pre-Transition Rating</div>
                  <div className="text-2xl font-bold">{prePeriodRating.weighted_avg_rating?.toFixed(2) || '-'}</div>
                  <div className="text-xs text-muted-foreground">{prePeriodRating.period_days} days</div>
                </div>
              )}
              {/* Post-transition rating - only show if manager should see post-transition */}
              {postPeriodRating && (managerRole === 'new_manager' || managerRole === 'same_manager') && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Post-Transition Rating</div>
                  <div className="text-2xl font-bold">{postPeriodRating.weighted_avg_rating?.toFixed(2) || '-'}</div>
                  <div className="text-xs text-muted-foreground">{postPeriodRating.period_days} days</div>
                </div>
              )}
              {/* Final rating - show if manager can see both periods or if it's available */}
              {finalRating && (managerRole === 'same_manager' || (!managerRole || managerRole === 'old_manager' || managerRole === 'new_manager')) && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Final Quarterly Rating</div>
                  <div className="text-2xl font-bold text-primary">{finalRating.final_quarterly_rating?.toFixed(2) || '-'}</div>
                  <div className="text-xs text-muted-foreground">{finalRating.calculation_method}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {transition ? (
        /* Transition Employee - Show Nested Period Tabs with Evaluation Tabs Inside */
        /* Only show tabs for same_manager; old_manager and new_manager don't have tabs */
        managerRole === 'same_manager' ? (
          <Tabs 
            value={nestedTab} 
            onValueChange={(value) => setNestedTab(value as 'pre-transition' | 'transition')}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="pre-transition">Pre-Transition</TabsTrigger>
              <TabsTrigger value="transition">Transition</TabsTrigger>
            </TabsList>
            
            {/* Pre-Transition Tab Content with Evaluation Tabs */}
            {/* For same_manager: show when pre-transition tab is active */}
            {managerRole === 'same_manager' && !isTransitionTab && (
              <TabsContent value="pre-transition" className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Badge variant={getPeriodBadgeVariant('pre_transition')}>
                    {getPeriodLabel('pre_transition')}
                  </Badge>
                  {transition.pre_period_start_date && transition.pre_period_end_date && (
                    <span className="text-sm text-muted-foreground">
                      {formatPeriodDateRange(transition.pre_period_start_date, transition.pre_period_end_date)}
                    </span>
                  )}
                  {transition.old_manager_name && (
                    <span className="text-sm text-muted-foreground ml-auto">
                      Manager: {transition.old_manager_name}
                    </span>
                  )}
                </div>
                
                <Tabs 
                  value={preTransitionEvaluationTab} 
                  onValueChange={setPreTransitionEvaluationTab}
                  className="space-y-4"
                >
                  <TabsList>
                    <TabsTrigger value="goals">KRA/KPI Ratings ({displayPreTransitionKpis.length})</TabsTrigger>
                    <TabsTrigger value="overall">Overall Assessment</TabsTrigger>
                    <TabsTrigger 
                      value="hr-review-rating"
                      onClick={() => {
                        if (activeCycle && managerId && selectedQuarter) {
                          fetchHrReviewRatings();
                        }
                      }}
                    >
                      HR Review Rating
                      {hrReviewRatings.length > 0 && (
                        <Badge variant="secondary" className="ml-2">{hrReviewRatings.length}</Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="goals" className="space-y-6">
                    {displayPreTransitionKras.length > 0 ? (
                      displayPreTransitionKras.map((kra) => {
                        const kraKpis = displayPreTransitionKpis.filter(k => k.kra_id === kra.id);
                        return renderKRACard(kra, kraKpis, relevantGoalSelfRatings, isSubmitted, selectedQuarter);
                      })
                    ) : (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          <p>No KRAs/KPIs found for the pre-transition period.</p>
                          <p className="text-sm mt-2">Goals from before the transition date should appear here.</p>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Action Buttons for KRA/KPI Ratings Tab */}
                    {!isSubmitted && canEvaluate && (
                      <div className="space-y-3 pt-4 border-t">
                        {hasLatePermission && quarterPeriodStatus.timing === 'past' && (
                          <Alert>
                            <Clock className="h-4 w-4" />
                            <AlertDescription>
                              You have been granted late submission access. You can submit this evaluation even though the deadline has passed.
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="flex justify-end gap-3">
                          <Button 
                            variant="outline" 
                            onClick={handleSave} 
                            disabled={saving}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </Button>
                          <Button 
                            onClick={() => setPreTransitionEvaluationTab('overall')}
                            disabled={saving}
                          >
                            Next
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="overall" className="space-y-4">
                    {relevantSelfEval && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Employee Self Assessment Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label className="text-muted-foreground">Overall Self Rating</Label>
                              <p className="font-medium mt-1">{getRatingLabel(relevantSelfEval.overall_rating)}</p>
                            </div>
                          </div>
                          {relevantSelfEval.overall_comments && (
                            <div>
                              <Label className="text-muted-foreground">Overall Comments</Label>
                              <p className="mt-1">{relevantSelfEval.overall_comments}</p>
                            </div>
                          )}
                          {relevantSelfEval.development_plan && (
                            <div>
                              <Label className="text-muted-foreground">Development Plan</Label>
                              <p className="mt-1">{relevantSelfEval.development_plan}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Calculated Quarterly Rating */}
                    <Card className="border-2 border-primary/20 bg-primary/5">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Calculator className="h-5 w-5" />
                          Pre-Transition Manager Rating (Auto-Calculated)
                        </CardTitle>
                        <CardDescription>
                          Calculated as weighted average of KRA ratings (KRA weights × KRA rating)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-background border-2 border-primary">
                          <span className="font-medium text-lg">Your Overall Rating for Pre-Transition</span>
                          <span className="text-3xl font-bold text-primary">
                            {calculatedQuarterRating !== null ? calculatedQuarterRating.toFixed(2) : '-'}
                          </span>
                        </div>
                        {calculatedQuarterRating === null && (
                          <Alert className="mt-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Rate all KPIs to see the calculated overall rating.
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>

                    {/* Manager Overall Assessment */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardCheck className="h-5 w-5" />
                          Manager Assessment Summary
                        </CardTitle>
                        <CardDescription>
                          Provide your overall assessment of {getEmployeeFirstName(employee)}'s performance for Pre-Transition
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2">
                          <Label>Overall Comments</Label>
                          <Textarea
                            placeholder={`Summarize ${getEmployeeFirstName(employee)}'s key achievements, strengths, and areas for improvement for pre-transition period...`}
                            value={overallComments}
                            onChange={(e) => setOverallComments(e.target.value)}
                            disabled={isSubmitted}
                            rows={4}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Guidance & Development Recommendations</Label>
                          <Textarea
                            placeholder="Provide guidance for improvement, suggest training, projects, or focus areas..."
                            value={developmentRecommendations}
                            onChange={(e) => setDevelopmentRecommendations(e.target.value)}
                            disabled={isSubmitted}
                            rows={4}
                          />
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Action Buttons for Overall Assessment Tab */}
                    {!isSubmitted && canEvaluate && (
                      <div className="space-y-3 pt-4 border-t">
                        {hasLatePermission && quarterPeriodStatus.timing === 'past' && (
                          <Alert>
                            <Clock className="h-4 w-4" />
                            <AlertDescription>
                              You have been granted late submission access. You can submit this evaluation even though the deadline has passed.
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="flex justify-end gap-3">
                          <Button 
                            variant="outline" 
                            onClick={handleSave} 
                            disabled={saving}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </Button>
                          <Button 
                            onClick={handleSubmit}
                            disabled={saving}
                            variant="primary"
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Submit
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="hr-review-rating" className="space-y-4">
                    {hrReviewLoading ? (
                      <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : hrReviewRatings.length === 0 ? (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                          <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                          <h3 className="font-semibold text-lg">No HR review ratings</h3>
                          <p className="text-muted-foreground">
                            No normalized ratings have been sent to you for review.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            HR has normalized and calibrated ratings for {employee?.full_name || 'this employee'}. Please review and accept or reject the rating.
                          </AlertDescription>
                        </Alert>
                        {hrReviewRatings.map((rating) => (
                          <Card key={rating.id}>
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div>
                                  <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    {rating.employee_name}
                                    <Badge variant="outline">{rating.employee_code}</Badge>
                                  </CardTitle>
                                  <CardDescription className="mt-2">
                                    Grade: {rating.grade} • Q{rating.quarter}
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                              {/* Ratings Display */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Raw Rating */}
                                <div className="p-4 rounded-lg border-2 bg-muted/30">
                                  <div className="text-sm font-medium text-muted-foreground mb-3">
                                    Raw Rating
                                  </div>
                                  <div className="text-3xl font-bold text-gray-700">
                                    {formatRating(rating.raw_rating)}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Original manager rating before normalization
                                  </p>
                                </div>

                                {/* HR Normalized Rating */}
                                <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                                  <div className="text-sm font-medium text-primary mb-3">
                                    HR Normalized Rating
                                  </div>
                                  <div className="text-3xl font-bold text-primary">
                                    {formatRating(rating.final_normalized_rating)}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    HR adjusted rating after normalization
                                  </p>
                                </div>

                                {/* Difference */}
                                <div className="p-4 rounded-lg border-2 bg-blue-50">
                                  <div className="text-sm font-medium text-blue-700 mb-3">
                                    Difference
                                  </div>
                                  <div className={`text-3xl font-bold ${rating.final_normalized_rating - rating.raw_rating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {rating.final_normalized_rating - rating.raw_rating >= 0 ? '+' : ''}
                                    {(rating.final_normalized_rating - rating.raw_rating).toFixed(2)}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Change from original rating
                                  </p>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex justify-end gap-3">
                                <Button
                                  variant="outline"
                                  onClick={() => handleManagerReview(rating.employee_id, 'REJECT')}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </Button>
                                <Button
                                  onClick={() => handleManagerReview(rating.employee_id, 'ACCEPT')}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Accept
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </TabsContent>
            )}
            
            {/* Transition Tab Content (Post-Transition) with Evaluation Tabs */}
            {/* For same_manager: show when transition tab is active */}
            {managerRole === 'same_manager' && isTransitionTab && (
              <TabsContent value="transition" className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Badge variant={getPeriodBadgeVariant('post_transition')}>
                    {getPeriodLabel('post_transition')}
                  </Badge>
                  {transition.post_period_start_date && transition.post_period_end_date && (
                    <span className="text-sm text-muted-foreground">
                      {formatPeriodDateRange(transition.post_period_start_date, transition.post_period_end_date)}
                    </span>
                  )}
                  {transition.new_manager_name && (
                    <span className="text-sm text-muted-foreground ml-auto">
                      Manager: {transition.new_manager_name}
                    </span>
                  )}
                </div>
                
                <Tabs 
                  value={transitionEvaluationTab} 
                  onValueChange={setTransitionEvaluationTab}
                  className="space-y-4"
                >
                  <TabsList>
                    <TabsTrigger value="goals">KRA/KPI Ratings ({displayPostTransitionKpis.length})</TabsTrigger>
                    <TabsTrigger value="overall">Overall Assessment</TabsTrigger>
                    <TabsTrigger 
                      value="hr-review-rating"
                      onClick={() => {
                        if (activeCycle && managerId && selectedQuarter) {
                          fetchHrReviewRatings();
                        }
                      }}
                    >
                      HR Review Rating
                      {hrReviewRatings.length > 0 && (
                        <Badge variant="secondary" className="ml-2">{hrReviewRatings.length}</Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="goals" className="space-y-6">
                    {displayPostTransitionKras.length > 0 ? (
                      displayPostTransitionKras.map((kra) => {
                        const kraKpis = displayPostTransitionKpis.filter(k => k.kra_id === kra.id);
                        return renderKRACard(kra, kraKpis, relevantGoalSelfRatings, isSubmitted, selectedQuarter);
                      })
                    ) : (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          <p>No KRAs/KPIs found for the post-transition period.</p>
                          <p className="text-sm mt-2">New goals can be created for the post-transition period.</p>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Action Buttons for KRA/KPI Ratings Tab */}
                    {!isSubmitted && canEvaluate && (
                      <div className="space-y-3 pt-4 border-t">
                        {hasLatePermission && quarterPeriodStatus.timing === 'past' && (
                          <Alert>
                            <Clock className="h-4 w-4" />
                            <AlertDescription>
                              You have been granted late submission access. You can submit this evaluation even though the deadline has passed.
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="flex justify-end gap-3">
                          <Button 
                            variant="outline" 
                            onClick={handleSave} 
                            disabled={saving}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </Button>
                          <Button 
                            onClick={() => setTransitionEvaluationTab('overall')}
                            disabled={saving}
                          >
                            Next
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="overall" className="space-y-4">
                    {relevantSelfEval && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Employee Self Assessment Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label className="text-muted-foreground">Overall Self Rating</Label>
                              <p className="font-medium mt-1">{getRatingLabel(relevantSelfEval.overall_rating)}</p>
                            </div>
                          </div>
                          {relevantSelfEval.overall_comments && (
                            <div>
                              <Label className="text-muted-foreground">Overall Comments</Label>
                              <p className="mt-1">{relevantSelfEval.overall_comments}</p>
                            </div>
                          )}
                          {relevantSelfEval.development_plan && (
                            <div>
                              <Label className="text-muted-foreground">Development Plan</Label>
                              <p className="mt-1">{relevantSelfEval.development_plan}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Calculated Quarterly Rating */}
                    <Card className="border-2 border-primary/20 bg-primary/5">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Calculator className="h-5 w-5" />
                          Post-Transition Manager Rating (Auto-Calculated)
                        </CardTitle>
                        <CardDescription>
                          Calculated as weighted average of KRA ratings (KRA weights × KRA rating)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-background border-2 border-primary">
                          <span className="font-medium text-lg">Your Overall Rating for Post-Transition</span>
                          <span className="text-3xl font-bold text-primary">
                            {calculatedQuarterRating !== null ? calculatedQuarterRating.toFixed(2) : '-'}
                          </span>
                        </div>
                        {calculatedQuarterRating === null && (
                          <Alert className="mt-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Rate all KPIs to see the calculated overall rating.
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>

                    {/* Manager Overall Assessment */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardCheck className="h-5 w-5" />
                          Manager Assessment Summary
                        </CardTitle>
                        <CardDescription>
                          Provide your overall assessment of {getEmployeeFirstName(employee)}'s performance for Post-Transition
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2">
                          <Label>Overall Comments</Label>
                          <Textarea
                            placeholder={`Summarize ${getEmployeeFirstName(employee)}'s key achievements, strengths, and areas for improvement for post-transition period...`}
                            value={overallComments}
                            onChange={(e) => setOverallComments(e.target.value)}
                            disabled={isSubmitted}
                            rows={4}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Guidance & Development Recommendations</Label>
                          <Textarea
                            placeholder="Provide guidance for improvement, suggest training, projects, or focus areas..."
                            value={developmentRecommendations}
                            onChange={(e) => setDevelopmentRecommendations(e.target.value)}
                            disabled={isSubmitted}
                            rows={4}
                          />
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Action Buttons for Overall Assessment Tab */}
                    {!isSubmitted && canEvaluate && (
                      <div className="space-y-3 pt-4 border-t">
                        {hasLatePermission && quarterPeriodStatus.timing === 'past' && (
                          <Alert>
                            <Clock className="h-4 w-4" />
                            <AlertDescription>
                              You have been granted late submission access. You can submit this evaluation even though the deadline has passed.
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="flex justify-end gap-3">
                          <Button 
                            variant="outline" 
                            onClick={handleSave} 
                            disabled={saving}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </Button>
                          <Button 
                            onClick={handleSubmit}
                            disabled={saving}
                            variant="primary"
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Submit
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="hr-review-rating" className="space-y-4">
                    {hrReviewLoading ? (
                      <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : hrReviewRatings.length === 0 ? (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                          <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                          <h3 className="font-semibold text-lg">No HR review ratings</h3>
                          <p className="text-muted-foreground">
                            No normalized ratings have been sent to you for review.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            HR has normalized and calibrated ratings for {employee?.full_name || 'this employee'}. Please review and accept or reject the rating.
                          </AlertDescription>
                        </Alert>
                        {hrReviewRatings.map((rating) => (
                          <Card key={rating.id}>
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div>
                                  <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    {rating.employee_name}
                                    <Badge variant="outline">{rating.employee_code}</Badge>
                                  </CardTitle>
                                  <CardDescription className="mt-2">
                                    Grade: {rating.grade} • Q{rating.quarter}
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                              {/* Ratings Display */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Raw Rating */}
                                <div className="p-4 rounded-lg border-2 bg-muted/30">
                                  <div className="text-sm font-medium text-muted-foreground mb-3">
                                    Raw Rating
                                  </div>
                                  <div className="text-3xl font-bold text-gray-700">
                                    {formatRating(rating.raw_rating)}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Original manager rating before normalization
                                  </p>
                                </div>

                                {/* HR Normalized Rating */}
                                <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                                  <div className="text-sm font-medium text-primary mb-3">
                                    HR Normalized Rating
                                  </div>
                                  <div className="text-3xl font-bold text-primary">
                                    {formatRating(rating.final_normalized_rating)}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    HR adjusted rating after normalization
                                  </p>
                                </div>

                                {/* Difference */}
                                <div className="p-4 rounded-lg border-2 bg-blue-50">
                                  <div className="text-sm font-medium text-blue-700 mb-3">
                                    Difference
                                  </div>
                                  <div className={`text-3xl font-bold ${rating.final_normalized_rating - rating.raw_rating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {rating.final_normalized_rating - rating.raw_rating >= 0 ? '+' : ''}
                                    {(rating.final_normalized_rating - rating.raw_rating).toFixed(2)}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Change from original rating
                                  </p>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex justify-end gap-3">
                                <Button
                                  variant="outline"
                                  onClick={() => handleManagerReview(rating.employee_id, 'REJECT')}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </Button>
                                <Button
                                  onClick={() => handleManagerReview(rating.employee_id, 'ACCEPT')}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Accept
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </TabsContent>
            )}
          </Tabs>
        ) : (
          /* For old_manager and new_manager, render content directly without tabs */
          <>
            {/* Old Manager: Show only pre-transition content (no tabs) */}
            {managerRole === 'old_manager' && !isTransitionTab && (
              <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Badge variant={getPeriodBadgeVariant('pre_transition')}>
                  {getPeriodLabel('pre_transition')}
                </Badge>
                {transition.pre_period_start_date && transition.pre_period_end_date && (
                  <span className="text-sm text-muted-foreground">
                    {formatPeriodDateRange(transition.pre_period_start_date, transition.pre_period_end_date)}
                  </span>
                )}
                {transition.old_manager_name && (
                  <span className="text-sm text-muted-foreground ml-auto">
                    Manager: {transition.old_manager_name}
                  </span>
                )}
              </div>
              
              <Tabs 
                value={preTransitionEvaluationTab} 
                onValueChange={setPreTransitionEvaluationTab}
                className="space-y-4"
              >
                <TabsList>
                  <TabsTrigger value="goals">KRA/KPI Ratings ({displayPreTransitionKpis.length})</TabsTrigger>
                  <TabsTrigger value="overall">Overall Assessment</TabsTrigger>
                  <TabsTrigger 
                    value="hr-review-rating"
                    onClick={() => {
                      if (activeCycle && managerId && selectedQuarter) {
                        fetchHrReviewRatings();
                      }
                    }}
                  >
                    HR Review Rating
                    {hrReviewRatings.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{hrReviewRatings.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="goals" className="space-y-6">
                  {/* <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardContent className="py-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                            <Star className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">
                              Pre-Transition Rating
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Weighted average of all KRA ratings
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-bold text-primary">
                            {calculatedQuarterRating !== null 
                              ? calculatedQuarterRating.toFixed(2) 
                              : '-'}
                          </div>
                          <div className="text-sm text-muted-foreground">out of 5</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card> */}

                  {displayPreTransitionKras.length > 0 ? (
                    displayPreTransitionKras.map((kra) => {
                      const kraKpis = displayPreTransitionKpis.filter(k => k.kra_id === kra.id);
                      return renderKRACard(kra, kraKpis, relevantGoalSelfRatings, isSubmitted, selectedQuarter);
                    })
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <p>No KRAs/KPIs found for the pre-transition period.</p>
                        <p className="text-sm mt-2">Goals from before the transition date should appear here.</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Action Buttons for KRA/KPI Ratings Tab */}
                  {!isSubmitted && canEvaluate && (
                    <div className="space-y-3 pt-4 border-t">
                      {hasLatePermission && quarterPeriodStatus.timing === 'past' && (
                        <Alert>
                          <Clock className="h-4 w-4" />
                          <AlertDescription>
                            You have been granted late submission access. You can submit this evaluation even though the deadline has passed.
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="flex justify-end gap-3">
                        <Button 
                          variant="outline" 
                          onClick={handleSave} 
                          disabled={saving}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                        <Button 
                          onClick={() => setPreTransitionEvaluationTab('overall')}
                          disabled={saving}
                        >
                          Next
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="overall" className="space-y-4">
                  {relevantSelfEval && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          Employee Self Assessment Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label className="text-muted-foreground">Overall Self Rating</Label>
                            <p className="font-medium mt-1">{getRatingLabel(relevantSelfEval.overall_rating)}</p>
                          </div>
                        </div>
                        {relevantSelfEval.overall_comments && (
                          <div>
                            <Label className="text-muted-foreground">Overall Comments</Label>
                            <p className="mt-1">{relevantSelfEval.overall_comments}</p>
                          </div>
                        )}
                        {relevantSelfEval.development_plan && (
                          <div>
                            <Label className="text-muted-foreground">Development Plan</Label>
                            <p className="mt-1">{relevantSelfEval.development_plan}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Calculated Quarterly Rating */}
                  <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        Pre-Transition Manager Rating (Auto-Calculated)
                      </CardTitle>
                      <CardDescription>
                        Calculated as weighted average of KRA ratings (KRA weights × KRA rating)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between p-4 rounded-lg bg-background border-2 border-primary">
                        <span className="font-medium text-lg">Your Overall Rating for Pre-Transition</span>
                        <span className="text-3xl font-bold text-primary">
                          {calculatedQuarterRating !== null ? calculatedQuarterRating.toFixed(2) : '-'}
                        </span>
                      </div>
                      {calculatedQuarterRating === null && (
                        <Alert className="mt-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Rate all KPIs to see the calculated overall rating.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Manager Overall Assessment */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5" />
                        Manager Assessment Summary
                      </CardTitle>
                      <CardDescription>
                        Provide your overall assessment of {getEmployeeFirstName(employee)}'s performance for Pre-Transition
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label>Overall Comments</Label>
                        <Textarea
                          placeholder={`Summarize ${getEmployeeFirstName(employee)}'s key achievements, strengths, and areas for improvement for pre-transition period...`}
                          value={overallComments}
                          onChange={(e) => setOverallComments(e.target.value)}
                          disabled={isSubmitted}
                          rows={4}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Guidance & Development Recommendations</Label>
                        <Textarea
                          placeholder="Provide guidance for improvement, suggest training, projects, or focus areas..."
                          value={developmentRecommendations}
                          onChange={(e) => setDevelopmentRecommendations(e.target.value)}
                          disabled={isSubmitted}
                          rows={4}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Action Buttons for Overall Assessment Tab */}
                  {!isSubmitted && canEvaluate && (
                    <div className="space-y-3 pt-4 border-t">
                      {hasLatePermission && quarterPeriodStatus.timing === 'past' && (
                        <Alert>
                          <Clock className="h-4 w-4" />
                          <AlertDescription>
                            You have been granted late submission access. You can submit this evaluation even though the deadline has passed.
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="flex justify-end gap-3">
                        <Button 
                          variant="outline" 
                          onClick={handleSave} 
                          disabled={saving}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                        <Button 
                          onClick={handleSubmit}
                          disabled={saving}
                          variant="primary"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Submit
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="hr-review-rating" className="space-y-4">
                  {hrReviewLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : hrReviewRatings.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-semibold text-lg">No HR review ratings</h3>
                        <p className="text-muted-foreground">
                          No normalized ratings have been sent to you for review.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          HR has normalized and calibrated ratings for {employee?.full_name || 'this employee'}. Please review and accept or reject the rating.
                        </AlertDescription>
                      </Alert>
                      {hrReviewRatings.map((rating) => (
                        <Card key={rating.id}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="flex items-center gap-2">
                                  <User className="h-5 w-5" />
                                  {rating.employee_name}
                                  <Badge variant="outline">{rating.employee_code}</Badge>
                                </CardTitle>
                                <CardDescription className="mt-2">
                                  Grade: {rating.grade} • Q{rating.quarter}
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Ratings Display */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Raw Rating */}
                              <div className="p-4 rounded-lg border-2 bg-muted/30">
                                <div className="text-sm font-medium text-muted-foreground mb-3">
                                  Raw Rating
                                </div>
                                <div className="text-3xl font-bold text-gray-700">
                                  {formatRating(rating.raw_rating)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Original manager rating before normalization
                                </p>
                              </div>

                              {/* HR Normalized Rating */}
                              <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                                <div className="text-sm font-medium text-primary mb-3">
                                  HR Normalized Rating
                                </div>
                                <div className="text-3xl font-bold text-primary">
                                  {formatRating(rating.final_normalized_rating)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  HR adjusted rating after normalization
                                </p>
                              </div>

                              {/* Difference */}
                              <div className="p-4 rounded-lg border-2 bg-blue-50">
                                <div className="text-sm font-medium text-blue-700 mb-3">
                                  Difference
                                </div>
                                <div className={`text-3xl font-bold ${rating.final_normalized_rating - rating.raw_rating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {rating.final_normalized_rating - rating.raw_rating >= 0 ? '+' : ''}
                                  {(rating.final_normalized_rating - rating.raw_rating).toFixed(2)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Change from original rating
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-3">
                              <Button
                                variant="outline"
                                onClick={() => handleManagerReview(rating.employee_id, 'REJECT')}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                              <Button
                                onClick={() => handleManagerReview(rating.employee_id, 'ACCEPT')}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Accept
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              </div>
            )}
            
            {/* New Manager: Show only post-transition content (no tabs) */}
            {managerRole === 'new_manager' && isTransitionTab && (
              <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Badge variant={getPeriodBadgeVariant('post_transition')}>
                  {getPeriodLabel('post_transition')}
                </Badge>
                {transition.post_period_start_date && transition.post_period_end_date && (
                  <span className="text-sm text-muted-foreground">
                    {formatPeriodDateRange(transition.post_period_start_date, transition.post_period_end_date)}
                  </span>
                )}
                {transition.new_manager_name && (
                  <span className="text-sm text-muted-foreground ml-auto">
                    Manager: {transition.new_manager_name}
                  </span>
                )}
              </div>
              
              <Tabs 
                value={transitionEvaluationTab} 
                onValueChange={setTransitionEvaluationTab}
                className="space-y-4"
              >
                <TabsList>
                  <TabsTrigger value="goals">KRA/KPI Ratings ({displayPostTransitionKpis.length})</TabsTrigger>
                  <TabsTrigger value="overall">Overall Assessment</TabsTrigger>
                  <TabsTrigger 
                    value="hr-review-rating"
                    onClick={() => {
                      if (activeCycle && managerId && selectedQuarter) {
                        fetchHrReviewRatings();
                      }
                    }}
                  >
                    HR Review Rating
                    {hrReviewRatings.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{hrReviewRatings.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="goals" className="space-y-6">
                  {/* <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardContent className="py-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                            <Star className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">
                              Post-Transition Rating
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Weighted average of all KRA ratings
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-bold text-primary">
                            {calculatedQuarterRating !== null 
                              ? calculatedQuarterRating.toFixed(2) 
                              : '-'}
                          </div>
                          <div className="text-sm text-muted-foreground">out of 5</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card> */}

                  {displayPostTransitionKras.length > 0 ? (
                    displayPostTransitionKras.map((kra) => {
                      const kraKpis = displayPostTransitionKpis.filter(k => k.kra_id === kra.id);
                      return renderKRACard(kra, kraKpis, relevantGoalSelfRatings, isSubmitted, selectedQuarter);
                    })
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <p>No KRAs/KPIs found for the post-transition period.</p>
                        <p className="text-sm mt-2">New goals can be created for the post-transition period.</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Action Buttons for KRA/KPI Ratings Tab */}
                  {!isSubmitted && canEvaluate && (
                    <div className="space-y-3 pt-4 border-t">
                      {hasLatePermission && quarterPeriodStatus.timing === 'past' && (
                        <Alert>
                          <Clock className="h-4 w-4" />
                          <AlertDescription>
                            You have been granted late submission access. You can submit this evaluation even though the deadline has passed.
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="flex justify-end gap-3">
                        <Button 
                          variant="outline" 
                          onClick={handleSave} 
                          disabled={saving}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                        <Button 
                          onClick={() => setTransitionEvaluationTab('overall')}
                          disabled={saving}
                        >
                          Next
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="overall" className="space-y-4">
                  {relevantSelfEval && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          Employee Self Assessment Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label className="text-muted-foreground">Overall Self Rating</Label>
                            <p className="font-medium mt-1">{getRatingLabel(relevantSelfEval.overall_rating)}</p>
                          </div>
                        </div>
                        {relevantSelfEval.overall_comments && (
                          <div>
                            <Label className="text-muted-foreground">Overall Comments</Label>
                            <p className="mt-1">{relevantSelfEval.overall_comments}</p>
                          </div>
                        )}
                        {relevantSelfEval.development_plan && (
                          <div>
                            <Label className="text-muted-foreground">Development Plan</Label>
                            <p className="mt-1">{relevantSelfEval.development_plan}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Calculated Quarterly Rating */}
                  <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        Post-Transition Manager Rating (Auto-Calculated)
                      </CardTitle>
                      <CardDescription>
                        Calculated as weighted average of KRA ratings (KRA weights × KRA rating)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between p-4 rounded-lg bg-background border-2 border-primary">
                        <span className="font-medium text-lg">Your Overall Rating for Post-Transition</span>
                        <span className="text-3xl font-bold text-primary">
                          {calculatedQuarterRating !== null ? calculatedQuarterRating.toFixed(2) : '-'}
                        </span>
                      </div>
                      {calculatedQuarterRating === null && (
                        <Alert className="mt-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Rate all KPIs to see the calculated overall rating.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Manager Overall Assessment */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5" />
                        Manager Assessment Summary
                      </CardTitle>
                      <CardDescription>
                        Provide your overall assessment of {getEmployeeFirstName(employee)}'s performance for Post-Transition
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label>Overall Comments</Label>
                        <Textarea
                          placeholder={`Summarize ${getEmployeeFirstName(employee)}'s key achievements, strengths, and areas for improvement for post-transition period...`}
                          value={overallComments}
                          onChange={(e) => setOverallComments(e.target.value)}
                          disabled={isSubmitted}
                          rows={4}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Guidance & Development Recommendations</Label>
                        <Textarea
                          placeholder="Provide guidance for improvement, suggest training, projects, or focus areas..."
                          value={developmentRecommendations}
                          onChange={(e) => setDevelopmentRecommendations(e.target.value)}
                          disabled={isSubmitted}
                          rows={4}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Action Buttons for Overall Assessment Tab */}
                  {!isSubmitted && canEvaluate && (
                    <div className="space-y-3 pt-4 border-t">
                      {hasLatePermission && quarterPeriodStatus.timing === 'past' && (
                        <Alert>
                          <Clock className="h-4 w-4" />
                          <AlertDescription>
                            You have been granted late submission access. You can submit this evaluation even though the deadline has passed.
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="flex justify-end gap-3">
                        <Button 
                          variant="outline" 
                          onClick={handleSave} 
                          disabled={saving}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                        <Button 
                          onClick={handleSubmit}
                          disabled={saving}
                          variant="primary"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Submit
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="hr-review-rating" className="space-y-4">
                  {hrReviewLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : hrReviewRatings.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-semibold text-lg">No HR review ratings</h3>
                        <p className="text-muted-foreground">
                          No normalized ratings have been sent to you for review.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          HR has normalized and calibrated ratings for {employee?.full_name || 'this employee'}. Please review and accept or reject the rating.
                        </AlertDescription>
                      </Alert>
                      {hrReviewRatings.map((rating) => (
                        <Card key={rating.id}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="flex items-center gap-2">
                                  <User className="h-5 w-5" />
                                  {rating.employee_name}
                                  <Badge variant="outline">{rating.employee_code}</Badge>
                                </CardTitle>
                                <CardDescription className="mt-2">
                                  Grade: {rating.grade} • Q{rating.quarter}
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Ratings Display */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Raw Rating */}
                              <div className="p-4 rounded-lg border-2 bg-muted/30">
                                <div className="text-sm font-medium text-muted-foreground mb-3">
                                  Raw Rating
                                </div>
                                <div className="text-3xl font-bold text-gray-700">
                                  {formatRating(rating.raw_rating)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Original manager rating before normalization
                                </p>
                              </div>

                              {/* HR Normalized Rating */}
                              <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                                <div className="text-sm font-medium text-primary mb-3">
                                  HR Normalized Rating
                                </div>
                                <div className="text-3xl font-bold text-primary">
                                  {formatRating(rating.final_normalized_rating)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  HR adjusted rating after normalization
                                </p>
                              </div>

                              {/* Difference */}
                              <div className="p-4 rounded-lg border-2 bg-blue-50">
                                <div className="text-sm font-medium text-blue-700 mb-3">
                                  Difference
                                </div>
                                <div className={`text-3xl font-bold ${rating.final_normalized_rating - rating.raw_rating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {rating.final_normalized_rating - rating.raw_rating >= 0 ? '+' : ''}
                                  {(rating.final_normalized_rating - rating.raw_rating).toFixed(2)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Change from original rating
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-3">
                              <Button
                                variant="outline"
                                onClick={() => handleManagerReview(rating.employee_id, 'REJECT')}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                              <Button
                                onClick={() => handleManagerReview(rating.employee_id, 'ACCEPT')}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Accept
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              </div>
            )}
          </>
        )
      ) : (
        /* Full Quarter (No Transition) - Keep Original Structure */
        <Tabs 
          value={evaluationTab} 
          onValueChange={handleTabChange}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="goals">KRA/KPI Ratings ({quarterKpis.length})</TabsTrigger>
            <TabsTrigger value="overall">Overall Assessment</TabsTrigger>
            <TabsTrigger 
              value="hr-review-rating"
              onClick={() => {
                if (activeCycle && managerId && selectedQuarter) {
                  fetchHrReviewRatings();
                }
              }}
            >
              HR Review Rating
              {hrReviewRatings.length > 0 && (
                <Badge variant="secondary" className="ml-2">{hrReviewRatings.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="goals" className="space-y-6">
            <Card className="border-2 border-primary/20 bg-primary/5">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <Star className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">
                        {quarterNumber ? `Q${quarterNumber}` : 'Overall'} Rating
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Weighted average of all KRA ratings
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-primary">
                      {calculatedQuarterRating !== null 
                        ? calculatedQuarterRating.toFixed(2) 
                        : '-'}
                    </div>
                    <div className="text-sm text-muted-foreground">out of 5</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Full Quarter (No Transition) */}
            {fullQuarterKras.map((kra) => {
              const kraKpis = fullQuarterKpis.filter(k => k.kra_id === kra.id);
              return renderKRACard(kra, kraKpis, relevantGoalSelfRatings, isSubmitted, selectedQuarter);
            })}
            
            {/* Action Buttons for KRA/KPI Ratings Tab */}
            {!isSubmitted && canEvaluate && (
              <div className="space-y-3 pt-4 border-t">
                {hasLatePermission && quarterPeriodStatus.timing === 'past' && (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      You have been granted late submission access. You can submit this evaluation even though the deadline has passed.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleSave} 
                    disabled={saving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <Button 
                    onClick={handleNext}
                    disabled={saving}
                  >
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="overall" className="space-y-4">
            {relevantSelfEval && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Employee Self Assessment Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Overall Self Rating</Label>
                      <p className="font-medium mt-1">{getRatingLabel(relevantSelfEval.overall_rating)}</p>
                    </div>
                  </div>
                  {relevantSelfEval.overall_comments && (
                    <div>
                      <Label className="text-muted-foreground">Overall Comments</Label>
                      <p className="mt-1">{relevantSelfEval.overall_comments}</p>
                    </div>
                  )}
                  {relevantSelfEval.development_plan && (
                    <div>
                      <Label className="text-muted-foreground">Development Plan</Label>
                      <p className="mt-1">{relevantSelfEval.development_plan}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Calculated Quarterly Rating - Using proper weighted average */}
            <Card className="border-2 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Q{selectedQuarter} Manager Rating (Auto-Calculated)
                </CardTitle>
                <CardDescription>
                  Calculated as weighted average of KRA ratings (KRA weights × KRA rating)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg bg-background border-2 border-primary">
                  <span className="font-medium text-lg">Your Overall Rating for Q{selectedQuarter}</span>
                  <span className="text-3xl font-bold text-primary">
                    {calculatedQuarterRating !== null ? calculatedQuarterRating.toFixed(2) : '-'}
                  </span>
                </div>
                {calculatedQuarterRating === null && (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Rate all KPIs to see the calculated overall rating.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Manager Overall Assessment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Manager Assessment Summary
                </CardTitle>
                <CardDescription>
                  Provide your overall assessment of {getEmployeeFirstName(employee)}'s performance for Q{selectedQuarter}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Overall Comments</Label>
                  <Textarea
                    placeholder={`Summarize ${getEmployeeFirstName(employee)}'s key achievements, strengths, and areas for improvement this quarter...`}
                    value={overallComments}
                    onChange={(e) => setOverallComments(e.target.value)}
                    disabled={isSubmitted}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Guidance & Development Recommendations</Label>
                  <Textarea
                    placeholder="Provide guidance for improvement, suggest training, projects, or focus areas for the next quarter..."
                    value={developmentRecommendations}
                    onChange={(e) => setDevelopmentRecommendations(e.target.value)}
                    disabled={isSubmitted}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Action Buttons for Overall Assessment Tab */}
            {!isSubmitted && canEvaluate && (
              <div className="space-y-3 pt-4 border-t">
                {hasLatePermission && quarterPeriodStatus.timing === 'past' && (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      You have been granted late submission access. You can submit this evaluation even though the deadline has passed.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleSave} 
                    disabled={saving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={saving}
                    variant="primary"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Submit
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="hr-review-rating" className="space-y-4">
            {hrReviewLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : hrReviewRatings.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No HR review ratings</h3>
                  <p className="text-muted-foreground">
                    No normalized ratings have been sent to you for review.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    HR has normalized and calibrated ratings for {employee?.full_name || 'this employee'}. Please review and accept or reject the rating.
                  </AlertDescription>
                </Alert>
                {hrReviewRatings.map((rating) => (
                  <Card key={rating.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            {rating.employee_name}
                            <Badge variant="outline">{rating.employee_code}</Badge>
                          </CardTitle>
                          <CardDescription className="mt-2">
                            Grade: {rating.grade} • Q{rating.quarter}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Ratings Display */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Raw Rating */}
                        <div className="p-4 rounded-lg border-2 bg-muted/30">
                          <div className="text-sm font-medium text-muted-foreground mb-3">
                            Raw Rating
                          </div>
                          <div className="text-3xl font-bold text-gray-700">
                            {formatRating(rating.raw_rating)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Original manager rating before normalization
                          </p>
                        </div>

                        {/* HR Normalized Rating */}
                        <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                          <div className="text-sm font-medium text-primary mb-3">
                            HR Normalized Rating
                          </div>
                          <div className="text-3xl font-bold text-primary">
                            {formatRating(rating.final_normalized_rating)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            After Box-Cox transformation and min-max scaling
                          </p>
                          {rating.final_normalized_rating && rating.raw_rating && (
                            <div className="text-xs mt-2">
                              {Math.abs(parseFloat(rating.final_normalized_rating) - parseFloat(rating.raw_rating)) < 0.01 ? (
                                <span className="text-muted-foreground">No change</span>
                              ) : parseFloat(rating.final_normalized_rating) > parseFloat(rating.raw_rating) ? (
                                <span className="text-green-600">
                                  ↑ +{(parseFloat(rating.final_normalized_rating) - parseFloat(rating.raw_rating)).toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-red-600">
                                  ↓ {(parseFloat(rating.final_normalized_rating) - parseFloat(rating.raw_rating)).toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Calibrated Rating */}
                        <div className="p-4 rounded-lg border-2 border-purple-300 bg-purple-50">
                          <div className="text-sm font-medium text-purple-600 mb-3">
                            Calibrated Rating
                          </div>
                          {rating.calibrated_rating !== null && rating.calibrated_rating !== undefined ? (
                            <>
                              <div className="text-3xl font-bold text-purple-600">
                                {'★'.repeat(rating.calibrated_rating)} ({rating.calibrated_rating})
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Bell curve distribution within grade
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="text-3xl font-bold text-muted-foreground">
                                -
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Calibration not applied yet
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          onClick={() => handleManagerReview(rating.employee_id, 'ACCEPT')}
                          variant="default"
                          className="flex-1"
                          size="lg"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Accept
                        </Button>
                        <Button
                          onClick={() => handleManagerReview(rating.employee_id, 'REJECT')}
                          variant="destructive"
                          className="flex-1"
                          size="lg"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
    );
  };

  // Render Year-End Evaluation Content (Only Overall Assessment - no KRA/KPI tabs)
  const renderYearEndEvaluationContent = () => {
    // For year-end, check if already submitted or released (HR approved)
    const yearEndSubmitted = Boolean(yearEndManagerEvaluation && 
      (yearEndManagerEvaluation.status === 'submitted' || yearEndManagerEvaluation.status === 'released'));
    const yearEndReleased = Boolean(yearEndManagerEvaluation && yearEndManagerEvaluation.status === 'released');
    
    return (
      <div className="space-y-6">
        {yearEndSubmitted && (
          <Alert className={yearEndReleased ? 'border-green-200 bg-green-50' : ''}>
            {yearEndReleased ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {yearEndReleased 
                ? 'This year-end evaluation has been approved by HR and released to the employee.'
                : 'This year-end evaluation has been submitted and is pending HR review.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Quarterly Ratings Summary */}
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Year-End Rating
            </CardTitle>
            <CardDescription>
              Calculated as the average of quarterly ratings. You can adjust the final rating below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {(['q1', 'q2', 'q3', 'q4'] as const).map((q, idx) => (
                <div key={q} className="p-3 rounded-lg bg-background border text-center">
                  <div className="text-xs text-muted-foreground mb-1">Q{idx + 1}</div>
                  <div className="font-semibold">
                    {quarterlyRatings[q] !== null ? formatRating(quarterlyRatings[q]) : '-'}
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex items-center justify-between p-4 rounded-lg bg-background border-2 border-primary">
              <span className="font-medium text-lg">Auto-Calculated Average</span>
              <span className="text-3xl font-bold text-primary">
                {formatRating(calculatedYearEndRating)}
              </span>
            </div>
            {calculatedYearEndRating === null && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Complete at least one quarterly review to calculate the year-end rating.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Manager's Editable Overall Rating */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Manager's Overall Rating <span className="text-destructive">*</span>
            </CardTitle>
            <CardDescription>
              Select the final year-end rating for {getEmployeeFirstName(employee)}. The auto-calculated rating is shown above for reference.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={overallRating?.toString() || ''}
              onValueChange={(value) => setOverallRating(parseInt(value))}
              disabled={yearEndSubmitted}
              className="space-y-3"
            >
              {ratingScales.map((scale) => (
                <div key={scale.value} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem
                    value={scale.value.toString()}
                    id={`year-end-rating-${scale.value}`}
                    className="mt-1"
                    disabled={yearEndSubmitted}
                  />
                  <Label htmlFor={`year-end-rating-${scale.value}`} className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4" style={{ color: scale.color || undefined }} />
                      <span className="font-medium">
                        {scale.value} - {scale.name}
                      </span>
                    </div>
                    {scale.description && (
                      <p className="text-sm text-muted-foreground mt-1">{scale.description}</p>
                    )}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {!overallRating && !yearEndSubmitted && (
              <p className="text-sm text-orange-600">Please select an overall rating</p>
            )}
          </CardContent>
        </Card>

        {/* Overall Feedback - Required */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Overall Feedback <span className="text-destructive">*</span>
            </CardTitle>
            <CardDescription>
              Provide comprehensive feedback on {getEmployeeFirstName(employee)}'s performance, achievements, and areas for improvement (Required)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Summarize key achievements, challenges, strengths, areas for improvement, and overall assessment for the year..."
              value={yearEndOverallComments}
              onChange={(e) => setYearEndOverallComments(e.target.value)}
              disabled={yearEndSubmitted}
              rows={5}
              className={!yearEndOverallComments.trim() && !yearEndSubmitted ? 'border-orange-300' : ''}
            />
            {!yearEndOverallComments.trim() && !yearEndSubmitted && (
              <p className="text-sm text-orange-600 mt-2">Overall feedback is required for submission</p>
            )}
          </CardContent>
        </Card>

        {/* Potential Rating */}
        <Card>
          <CardHeader>
            <CardTitle>Potential Rating</CardTitle>
            <CardDescription>Assess {getEmployeeFirstName(employee)}'s growth potential for succession planning</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={potentialRating?.toString() || ''}
              onValueChange={(value) => setPotentialRating(parseInt(value))}
              disabled={yearEndSubmitted}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="3" id="ye-potential-3" className="mt-1" disabled={yearEndSubmitted} />
                <Label htmlFor="ye-potential-3" className="cursor-pointer flex-1">
                  <div className="font-medium">High Potential</div>
                  <p className="text-sm text-muted-foreground">
                    Ready for promotion within 1-2 years, demonstrates leadership capabilities
                  </p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="2" id="ye-potential-2" className="mt-1" disabled={yearEndSubmitted} />
                <Label htmlFor="ye-potential-2" className="cursor-pointer flex-1">
                  <div className="font-medium">Medium Potential</div>
                  <p className="text-sm text-muted-foreground">
                    Growing in role, may be ready for advancement with development
                  </p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="1" id="ye-potential-1" className="mt-1" disabled={yearEndSubmitted} />
                <Label htmlFor="ye-potential-1" className="cursor-pointer flex-1">
                  <div className="font-medium">Low Potential</div>
                  <p className="text-sm text-muted-foreground">
                    Performing well in current role, limited growth trajectory
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {!yearEndSubmitted && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleSave} 
              disabled={saving}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={saving || !overallRating || !yearEndOverallComments.trim()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              Submit for HR Review
            </Button>
          </div>
        )}

      
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/team')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {getEmployeeInitials(employee)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl">
                  {getEmployeeDisplayName(employee)}
                </CardTitle>
                <CardDescription>{employee?.email || 'No email'}</CardDescription>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{employee?.department || 'No department'}</Badge>
                  <Badge variant="secondary">{employee?.grade || 'No grade'}</Badge>
                  <Badge>{employee?.emp_id || 'No ID'}</Badge>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {hasHRRejection && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <div className="font-semibold mb-2">HR Review Rejected</div>
              <div className="text-sm">
                <strong>Rejection Reason:</strong> {managerEvaluation.hr_rejection_reason}
              </div>
              <div className="text-xs mt-2 italic">
                Please review the feedback above and resubmit your evaluation after making necessary changes.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isSubmitted && !hasHRRejection && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>This evaluation has been submitted and is pending HR review.</AlertDescription>
          </Alert>
        )}

        {/* Centralized Evaluation Period Tabs */}
        <EvaluationPeriodTabs
          cycle={activeCycle}
          quarterlyCycles={quarterlyCycles}
          quarterlySelfEvals={quarterlySelfEvals}
          yearEndSelfEvalStatus={selfEvaluation?.status}
          defaultTab={evaluationMode}
          selectedQuarter={selectedQuarter}
          onTabChange={handleEvaluationTabChange}
          onQuarterChange={handleQuarterChange}
          managerReview={managerReview}
          quarterlyContent={
            canEvaluate || isSubmitted ? (
              renderQuarterlyRatingContent()
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <User className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">Cannot evaluate yet</h3>
                  <p className="text-muted-foreground text-center">
                    {(() => {
                      // Priority 1: If manager has late permission and period is past, show late permission message
                      if (hasLatePermission && quarterPeriodStatus.timing === 'past') {
                        console.log('[Message] Showing late permission message');
                        return `You have late submission access. ${getEmployeeFirstName(employee)} must complete their Q${selectedQuarter} self-review first before you can evaluate.`;
                      }
                      
                      // Priority 2: If period is past and no late permission, show period closed message
                      if (!(hasTransitionForQuarter && isWithinQuarterDates) && quarterPeriodStatus.timing !== 'current' && !hasLatePermission) {
                        console.log('[Message] Showing period closed message');
                        return quarterPeriodStatus.message;
                      }
                      
                      // Priority 3: Default - show self-review requirement
                      console.log('[Message] Showing self-review requirement message');
                      return `${getEmployeeFirstName(employee)} must complete their Q${selectedQuarter} self-review first`;
                    })()}
                  </p>
                </CardContent>
              </Card>
            )
          }
          yearEndContent={renderYearEndEvaluationContent()}
        />
      </div>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reject {rejectingItem?.type.toUpperCase()}</DialogTitle>
            <DialogDescription>
              Provide feedback for rejecting {rejectingItem?.type === 'kra' ? 'KRA' : 'KPI'}: <strong>{rejectingItem?.title}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this KRA/KPI is being rejected and what needs to be improved..."
                rows={5}
                aria-required="true"
                aria-label="Rejection reason"
              />
              <p className="text-xs text-muted-foreground">
                This feedback will be sent to the employee. They can only resubmit once per quarter.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectionDialogOpen(false);
                setRejectingItem(null);
                setRejectionReason('');
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRejection}
              disabled={!rejectionReason.trim() || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject {rejectingItem?.type.toUpperCase()}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
