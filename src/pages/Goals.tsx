// Goals Page - Refactored with hooks and services
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Send, Copy, ChevronDown, Calendar, Lock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageLoader } from '@/loaders';
import { useGoalsData, useKraOperations, useKpiOperations, useTemplateSelection, useCurrentEmployee } from '@/hooks';
import { useQuarterFromUrl } from '@/hooks/useQuarterFromUrl';
import { getValidationIssues, hasDraftItems, isValidForSubmission } from '@/utils/goalsValidation';
import {
  getAvailableQuartersForEmployee,
  getPreviousQuarters,
  formatQuarterLabel,
  hasQuarterStarted,
  hasQuarterEnded,
  canWorkOnQuarter,
  getQuarterStartDateFromCycle,
  getQuarterEndDateFromCycle,
  formatDateShort,
  type CycleWithQuarterDates
} from '@/utils/quarterHelpers';
import { GoalStatusAlerts } from '@/components/goals/GoalsStatusAlerts';
import { GoalsProgressCard } from '@/components/goals/GoalsProgressCard';
import { GoalsEmptyState } from '@/components/goals/GoalsEmptyState';
import { ValidationAlert } from '@/components/goals/ValidationAlert';
import { KRACard } from '@/components/goals/KRACard';
import { KRAForm } from '@/components/goals/KRAForm';
import { KPIForm } from '@/components/goals/KPIForm';
import { TemplateSelector } from '@/components/goals/TemplateSelector';
import { employeeService, goalsService } from '@/services';
import { toasts } from '@/toasts';
import type { KRA, Goal, Employee } from '@/types';
import type { GoalsQuarterlyCycle } from '@/services/cycle.service';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import PeriodClose from '@/components/evaluation/PeriodClose';

export default function Goals() {
  const { user, hasAnyRole } = useAuth();
  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin', 'dept_head', 'manager']);

  // URL-based quarter handling
  const { quarter, setQuarter, isValidQuarter } = useQuarterFromUrl();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get current employee from cached hook (fetched once at app initialization)
  const { employee, isLoading: loadingEmployee } = useCurrentEmployee();

  // Get active cycle data from context (fetched once at app initialization)
  const { activeCycle: activeCycleFromContext, goalsQuarterlyCycles: goalsQuarterlyCyclesFromContext, goalSetting } = useActiveCycle();

  // State to track if we're viewing the transition tab - read from URL
  const isTransitionTabFromUrl = searchParams.get('transition') === 'true';
  const [isTransitionTab, setIsTransitionTab] = useState(isTransitionTabFromUrl);
  
  // Sync transition tab state with URL
  useEffect(() => {
    setIsTransitionTab(isTransitionTabFromUrl);
  }, [isTransitionTabFromUrl]);
  
  // Fetch all goals data - fetch for transition quarter when in transition tab, otherwise use selected quarter
  const currentQuarter = useMemo(() => {
    if (isTransitionTab) {
      // We'll get transition from goalsData, but for now fetch all quarters
      return null; // Fetch all goals, we'll filter by transition
    }
    return quarter || null;
  }, [isTransitionTab, quarter]);
  
  const goalsData = useGoalsData(user?.id, currentQuarter);
  const { employeeId, employeeProfile, kras: allKras, kpis: allKpis, hasLatePermission, hasActiveTransition, transition, loading, refetch } = goalsData;
  
  // Clean up URL if transition parameter exists but no active transition
  useEffect(() => {
    if (isTransitionTabFromUrl && !hasActiveTransition) {
      // Remove transition parameter if no active transition exists
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('transition');
        return newParams;
      }, { replace: true });
    }
  }, [isTransitionTabFromUrl, hasActiveTransition, setSearchParams]);
  
  // When in transition tab, also fetch goals for the transition quarter specifically
  const transitionQuarterForFetch = transition?.quarter || null;
  const transitionGoalsData = useGoalsData(
    user?.id, 
    isTransitionTab && transitionQuarterForFetch ? transitionQuarterForFetch : null
  );
  
  // Combined refetch function that refetches both data sources when needed
  const refetchAllGoals = useCallback(() => {
    goalsData.refetch();
    if (isTransitionTab && transitionQuarterForFetch) {
      transitionGoalsData.refetch();
    }
  }, [goalsData.refetch, transitionGoalsData.refetch, isTransitionTab, transitionQuarterForFetch]);
  
  // Filter goals for transition tab (only post-transition) or regular tabs (exclude post-transition)
  const { kras, kpis } = useMemo(() => {
    if (isTransitionTab && hasActiveTransition && transition) {
      // In transition tab: use transition-specific goals data and show only post-transition goals
      const transitionKras = (transitionGoalsData.kras || []).filter(kra => 
        kra.period_type === 'post_transition' && kra.transition_id === transition.id
      );
      const transitionKpis = (transitionGoalsData.kpis || []).filter(kpi => 
        kpi.period_type === 'post_transition' && kpi.transition_id === transition.id
      );
      return { kras: transitionKras, kpis: transitionKpis };
    } else {
      // In regular tabs: show pre-transition and full_quarter goals, exclude post-transition goals
      // This ensures pre-transition goals (set before transition) are visible
      const regularKras = allKras.filter(kra => {
        // Include if no period_type (full_quarter) or if pre_transition
        if (!kra.period_type || kra.period_type === 'full_quarter') {
          return true;
        }
        // Include pre_transition goals (even if they have transition_id)
        if (kra.period_type === 'pre_transition') {
          return true;
        }
        // Exclude post_transition goals
        return false;
      });
      const regularKpis = allKpis.filter(kpi => {
        // Include if no period_type (full_quarter) or if pre_transition
        if (!kpi.period_type || kpi.period_type === 'full_quarter') {
          return true;
        }
        // Include pre_transition goals (even if they have transition_id)
        if (kpi.period_type === 'pre_transition') {
          return true;
        }
        // Exclude post_transition goals
        return false;
      });
      return { kras: regularKras, kpis: regularKpis };
    }
  }, [isTransitionTab, hasActiveTransition, transition, allKras, allKpis, transitionGoalsData.kras, transitionGoalsData.kpis]);

  // Use active cycle from context (prefer context over hook data for consistency)
  const activeCycle = activeCycleFromContext || goalsData.activeCycle;
  const goalsQuarterlyCycles = (goalsQuarterlyCyclesFromContext || []) as GoalsQuarterlyCycle[];

  // Helper to get goal submission start date for a quarter
  const getGoalSubmissionStartDate = (quarter: number): Date | null => {
    const goalsCycle = goalsQuarterlyCycles.find((gqc: GoalsQuarterlyCycle) => gqc.quarter === quarter);
    if (goalsCycle?.goal_submission_start_date) {
      return new Date(goalsCycle.goal_submission_start_date);
    }
    return null;
  };

  // Helper to get goal submission end date for a quarter
  const getGoalSubmissionEndDate = (quarter: number): Date | null => {
    const goalsCycle = goalsQuarterlyCycles.find((gqc: GoalsQuarterlyCycle) => gqc.quarter === quarter);
    if (goalsCycle?.goal_submission_end_date) {
      return new Date(goalsCycle.goal_submission_end_date);
    }
    return null;
  };

  // Helper to check if goal submission period has started for a quarter
  const hasGoalSubmissionStarted = (quarter: number): boolean => {
    const startDate = getGoalSubmissionStartDate(quarter);
    if (!startDate) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    return now >= start;
  };

  // Helper to check if goal submission period has ended for a quarter
  const hasGoalSubmissionEnded = (quarter: number): boolean => {
    const endDate = getGoalSubmissionEndDate(quarter);
    if (!endDate) return false;
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return now > end;
  };

  // Helper to check if current date is within quarter date range
  const isWithinQuarterDates = (quarter: number): boolean => {
    const goalsCycle = goalsQuarterlyCycles.find((gqc: GoalsQuarterlyCycle) => gqc.quarter === quarter);
    if (!goalsCycle?.quarterly_start_date || !goalsCycle?.quarterly_end_date) {
      return false;
    }
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const quarterStart = new Date(goalsCycle.quarterly_start_date);
    quarterStart.setHours(0, 0, 0, 0);
    const quarterEnd = new Date(goalsCycle.quarterly_end_date);
    quarterEnd.setHours(23, 59, 59, 999);
    
    return now >= quarterStart && now <= quarterEnd;
  };

  // Helper to check if employee can work on goals for a quarter
  const canWorkOnGoalsForQuarter = (quarter: number): { canWork: boolean; reason: 'not_started' | 'ended' | 'ok' } => {
    // If there's an active transition, NO validation needed - allow goal creation at any time
    // This is per the workflow requirement: "transition employees can set goals at any day in the quarter, no validation needed"
    if (hasActiveTransition && transition && transition.quarter === quarter) {
        return { canWork: true, reason: 'ok' };
    }
    
    const started = hasGoalSubmissionStarted(quarter);
    const ended = hasGoalSubmissionEnded(quarter);

    if (!started) {
      return { canWork: false, reason: 'not_started' };
    }

    if (ended && !hasLatePermission) {
      return { canWork: false, reason: 'ended' };
    }

    return { canWork: true, reason: 'ok' };
  };

  // Get available quarters based on join date - use actual dates from goals_quarterly_cycles
  const availableQuarters = useMemo(() => {
    if (!employee || !activeCycle) return [];
    return getAvailableQuartersForEmployee(employee, activeCycle, goalsQuarterlyCycles);
  }, [employee, activeCycle, goalsQuarterlyCycles]);


  useEffect(() => {
    if (!loadingEmployee && !isValidQuarter && availableQuarters.length > 0 && activeCycle) {
      // Use backend response to determine default quarter for goal setting
      if (goalSetting?.enabled && goalSetting?.quarter && availableQuarters.includes(goalSetting.quarter as 1 | 2 | 3 | 4)) {
        setQuarter(goalSetting.quarter as 1 | 2 | 3 | 4);
        return;
      }
      
      // Fallback to date-based calculation if backend data not available
      if (goalsQuarterlyCycles.length > 0) {
      // Iterate through quarters in order (1,2,3,4) to find first available and started quarter
      for (let q = 1; q <= 4; q++) {
        if (availableQuarters.includes(q as 1 | 2 | 3 | 4) && hasGoalSubmissionStarted(q)) {
          setQuarter(q as 1 | 2 | 3 | 4);
          return;
        }
      }
      // If no quarter has started, find first available quarter in order
      for (let q = 1; q <= 4; q++) {
        if (availableQuarters.includes(q as 1 | 2 | 3 | 4)) {
          setQuarter(q as 1 | 2 | 3 | 4);
          return;
        }
      }
      } else {
      // Fallback if goalsQuarterlyCycles not loaded yet - find first available quarter in order
      for (let q = 1; q <= 4; q++) {
        if (availableQuarters.includes(q as 1 | 2 | 3 | 4)) {
          setQuarter(q as 1 | 2 | 3 | 4);
          return;
        }
      }
    }
    }
  }, [loadingEmployee, isValidQuarter, availableQuarters, activeCycle, goalsQuarterlyCycles, setQuarter, hasGoalSubmissionStarted, goalSetting]);

  // Get previous quarters for clone dropdown
  const previousQuarters = useMemo(() => {
    if (!quarter) return [];
    return getPreviousQuarters(quarter, availableQuarters);
  }, [quarter, availableQuarters]);

  // Form dialog states
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [kraFormOpen, setKraFormOpen] = useState(false);
  const [editingKRA, setEditingKRA] = useState<KRA | null>(null);
  const [kpiFormOpen, setKpiFormOpen] = useState(false);
  const [editingKPI, setEditingKPI] = useState<Goal | null>(null);
  const [selectedKRAId, setSelectedKRAId] = useState<string | null>(null);

  // Clone goals handler
  const handleCloneGoals = async (sourceQuarter: number) => {
    if (!employeeId || !activeCycle?.id || !quarter) {
      toasts.error('Cannot clone goals', 'Missing required information');
      return;
    }

    try {
      const result = await goalsService.clone.cloneGoals(
        employeeId,
        activeCycle.id,
        sourceQuarter,
        quarter
      );

      if (result.data) {
        toasts.success(
          'Goals Cloned',
          `Successfully cloned ${result.data.kras.length} KRAs and ${result.data.kpis.length} KPIs from ${formatQuarterLabel(sourceQuarter)} to ${formatQuarterLabel(quarter)}`
        );
        refetchAllGoals();
      }
    } catch (error: any) {
      toasts.error('Clone Failed', error.message || 'Failed to clone goals');
    }
  };

  // When in transition tab, use transition quarter and ensure goals are marked as post-transition
  const transitionQuarter = isTransitionTab && transition ? transition.quarter : quarter;
  
  // KRA Operations
  const kraOps = useKraOperations({
    employeeId,
    cycleId: activeCycle?.id || null,
    kras,
    kpis,
    onSuccess: refetchAllGoals,
    quarter: transitionQuarter || null,
  });

  // KPI Operations
  const kpiOps = useKpiOperations({
    employeeId,
    cycleId: activeCycle?.id || null,
    kpis,
    onSuccess: refetchAllGoals,
    quarter: transitionQuarter || null,
  });

  // Template Selection
  const templateSelection = useTemplateSelection({
    employeeId,
    cycleId: activeCycle?.id || null,
    krasCount: kras.length,
    availableKRAWeight: kraOps.availableKRAWeight,
    onSuccess: refetchAllGoals,
    quarter: quarter || null,
  });

  // Computed values - use quarterly goal submission deadline for quarterly goals
  const deadlineStatus = useMemo(() => {
    if (!activeCycle || !quarter) return null;

    // Get goal submission end date for the current quarter
    const goalEndDate = getGoalSubmissionEndDate(quarter);
    if (!goalEndDate) return null;

    const now = new Date();
    const deadline = new Date(goalEndDate);
    // Set deadline to end of day (23:59:59.999) so the entire deadline day is included
    deadline.setHours(23, 59, 59, 999);
    const isPastDeadline = now > deadline;
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)));

    // Check if late submission is allowed for this quarter
    const goalsCycle = goalsQuarterlyCycles.find((gqc: GoalsQuarterlyCycle) => gqc.quarter === quarter);
    const allowLate = goalsCycle?.allow_late_goal_submission || activeCycle.allow_late_goal_submission || false;
    const canSubmit = !isPastDeadline || allowLate || hasLatePermission;

    return {
      isPastDeadline,
      daysOverdue,
      canSubmit,
      formattedDeadline: format(deadline, 'MMMM d, yyyy'),
    };
  }, [activeCycle, quarter, hasLatePermission, goalsQuarterlyCycles]);

  const validationIssues = useMemo(
    () => getValidationIssues(kras, kpis, kraOps.getKPIsForKRA),
    [kras, kpis, kraOps.getKPIsForKRA]
  );

  // Use goal submission dates instead of self-review dates for goals
  const quarterWorkStatus = useMemo(() => {
    if (!quarter || !activeCycle) return { canWork: false, reason: 'not_started' as const };
    return canWorkOnGoalsForQuarter(quarter);
  }, [quarter, activeCycle, hasLatePermission, goalsQuarterlyCycles, hasActiveTransition, transition]);


  // Allow goal creation if there's an active transition AND we're within quarter dates
  const canSubmitWithTransition = hasActiveTransition && transition && transition.quarter === quarter && isWithinQuarterDates(transition.quarter);
  const canSubmit = quarterWorkStatus.canWork || (deadlineStatus?.canSubmit ?? false) || canSubmitWithTransition;

  const quarterHasStarted = useMemo(() => {
    if (!quarter || !activeCycle) return false;
    return hasGoalSubmissionStarted(quarter);
  }, [quarter, activeCycle, goalsQuarterlyCycles]);

  const quarterHasEnded = useMemo(() => {
    if (!quarter || !activeCycle) return false;
    return hasGoalSubmissionEnded(quarter);
  }, [quarter, activeCycle, goalsQuarterlyCycles]);

  // Check if goals are submitted/approved
  const hasSubmittedOrApprovedGoals = useMemo(() => {
    if (kras.length === 0 && kpis.length === 0) return false;
    // Check if at least one KRA is submitted/approved/locked
    const hasSubmittedKRAs = kras.some(k => 
      k.status === 'submitted' || k.status === 'approved' || k.status === 'locked'
    );
    // Check if at least one KPI is submitted/approved/locked
    const hasSubmittedKPIs = kpis.some(k => 
      k.status === 'submitted' || k.status === 'approved' || k.status === 'locked'
    );
    return hasSubmittedKRAs || hasSubmittedKPIs;
  }, [kras, kpis]);

  // For transition employees: NO validation needed - they can set goals at any time within the quarter
  // For regular employees: 
  // - If goals are submitted/approved: Can view but cannot add (unless late permission)
  // - If goals are NOT submitted/approved: Can add only if within period OR has late permission
  const canAddGoals = isTransitionTab 
    ? (hasActiveTransition && transition) // No date validation for transition employees
    : (
        // Enable Add KRA only if:
        // 1. Has late submission permission (always allowed)
        // 2. OR within normal submission period AND goals not yet submitted/approved
        (hasLatePermission) || 
        (canSubmit && quarterWorkStatus.canWork && !hasSubmittedOrApprovedGoals)
      );
  const showAddButton = activeCycle && employeeId && kras.length < 5 && canAddGoals;
  const showCloneButton = previousQuarters.length > 0 && quarter && quarterWorkStatus.canWork;
  const hasDraft = hasDraftItems(kras, kpis);
  const isValid = isValidForSubmission(kras, kpis, kraOps.getKPIsForKRA);
  
  // Check if all KRAs/KPIs for this quarter are already submitted/approved (no draft items)
  // Hide submit button if everything is already submitted/approved
  // Note: kras and kpis are already filtered by transition tab vs regular tab
  const allSubmittedOrApproved = useMemo(() => {
    // If no items, not submitted
    if (kras.length === 0 && kpis.length === 0) return false;
    
    // Check if all KRAs are submitted/approved/locked (not draft or returned)
    // This means employee/manager has already submitted them
    const allKRAsSubmitted = kras.every(k => 
      k.status === 'submitted' || k.status === 'approved' || k.status === 'locked'
    );
    
    // Check if all KPIs are submitted/approved/locked (not draft or returned)
    // This means employee/manager has already submitted them
    const allKPIsSubmitted = kpis.every(k => 
      k.status === 'submitted' || k.status === 'approved' || k.status === 'locked'
    );
    
    return allKRAsSubmitted && allKPIsSubmitted;
  }, [kras, kpis]);
  const selectedKRA = selectedKRAId ? kras.find(k => k.id === selectedKRAId) : null;


  // Loading state
  if (loading || loadingEmployee) {
    return (
      <MainLayout>
        <PageLoader />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Goals</h1>
            <p className="text-muted-foreground">{activeCycle?.name || 'No active cycle'}</p>
          </div>
          <div className="flex gap-2">
            {showCloneButton && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Copy className="mr-2 h-4 w-4" />
                    Clone from
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {previousQuarters.map(q => (
                    <DropdownMenuItem
                      key={q}
                      onClick={() => handleCloneGoals(q)}
                    >
                      Clone from {formatQuarterLabel(q)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {showAddButton && (
              <Button onClick={() => setTemplateSelectorOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add KRA
              </Button>
            )}
          </div>
        </div>

        {/* Quarter Tabs */}
        {activeCycle && availableQuarters.length > 0 && (
          <TooltipProvider>
            <Tabs value={isTransitionTab ? 'transition' : (quarter ? `q${quarter}` : undefined)} onValueChange={(value) => {
              if (value === 'transition') {
                setIsTransitionTab(true);
                // Update URL to include transition parameter and set quarter to transition quarter
                if (transition && transition.quarter) {
                  setSearchParams(prev => {
                    const newParams = new URLSearchParams(prev);
                    newParams.set('quarter', `q${transition.quarter}`);
                    newParams.set('transition', 'true');
                    return newParams;
                  }, { replace: true });
                } else {
                  setSearchParams(prev => {
                    const newParams = new URLSearchParams(prev);
                    newParams.set('transition', 'true');
                    return newParams;
                  }, { replace: true });
                }
              } else {
                setIsTransitionTab(false);
                // Remove transition parameter from URL
                setSearchParams(prev => {
                  const newParams = new URLSearchParams(prev);
                  newParams.delete('transition');
                  return newParams;
                }, { replace: true });
                
                const q = parseInt(value.replace('q', ''));
                if (q >= 1 && q <= 4) {
                  // Only allow changing to quarters where goal submission has started
                  const goalStarted = hasGoalSubmissionStarted(q);
                  if (goalStarted) {
                    setQuarter(q as 1 | 2 | 3 | 4);
                  }
                }
              }
            }}>
              <TabsList>
                {/* Transition Tab - Only visible if employee has active transition */}
                {hasActiveTransition && transition && (
                  <TabsTrigger value="transition">
                    Transition
                  </TabsTrigger>
                )}
                {availableQuarters.map(q => {
                  // Use backend response to determine if goal setting is enabled for this quarter
                  // Enable tab if: it's the current goal_setting quarter AND goal_setting.enabled is true
                  // OR if goals have already been created for this quarter (allow viewing past quarters)
                  const isCurrentGoalQuarter = goalSetting?.quarter === q;
                  const isGoalSettingEnabled = isCurrentGoalQuarter && goalSetting?.enabled === true;
                  
                  // Check if goals exist for this quarter (to allow viewing past quarters)
                  const hasGoalsForQuarter = allKras.some(kra => kra.quarter === q) || allKpis.some(kpi => kpi.quarter === q);
                  
                  // Enable tab if goal setting is enabled OR if goals already exist
                  const isTabEnabled = isGoalSettingEnabled || hasGoalsForQuarter;
                  
                  // Fallback to date calculation if backend data not available
                  const goalStarted = goalSetting ? isTabEnabled : hasGoalSubmissionStarted(q);
                  const startDate = getGoalSubmissionStartDate(q) || getQuarterStartDateFromCycle(activeCycle as CycleWithQuarterDates, q);
                  const endDate = getGoalSubmissionEndDate(q) || getQuarterEndDateFromCycle(activeCycle as CycleWithQuarterDates, q);

                  if (!goalStarted) {
                    return (
                      <Tooltip key={q}>
                        <TooltipTrigger asChild>
                          <span>
                            <TabsTrigger
                              value={`q${q}`}
                              disabled
                              className="opacity-50 cursor-not-allowed"
                            >
                              {formatQuarterLabel(q)}
                              <Lock className="ml-1 h-3 w-3" />
                            </TabsTrigger>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p>
                            {formatQuarterLabel(q)} has not started yet.
                            {startDate && endDate && (
                              <> It will be open from {formatDateShort(startDate)} to {formatDateShort(endDate)}.</>
                            )}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <TabsTrigger 
                      key={q} 
                      value={`q${q}`}
                      onClick={() => {
                        setIsTransitionTab(false);
                        // Remove transition parameter from URL when switching to regular quarter tab
                        setSearchParams(prev => {
                          const newParams = new URLSearchParams(prev);
                          newParams.delete('transition');
                          return newParams;
                        }, { replace: true });
                      }}
                    >
                      {formatQuarterLabel(q)}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {/* Transition Tab Content */}
              {hasActiveTransition && transition && (
                <TabsContent value="transition" className="space-y-6">
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">Post-Transition Goals</h3>
                          <p className="text-sm text-muted-foreground">
                            You have a mid-quarter transition on {transition.transition_date ? new Date(transition.transition_date).toLocaleDateString() : 'N/A'}. 
                            Create new goals for the post-transition period here. These goals will be reviewed by your new manager.
                          </p>
                          {transition.new_manager_name && (
                            <p className="text-sm text-muted-foreground mt-1">
                              New Manager: <span className="font-medium">{transition.new_manager_name}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {activeCycle && employeeId && (
                    <>
                      <GoalsProgressCard totalWeight={kraOps.totalKRAWeight} krasCount={kras.length} />

                      {kras.length === 0 ? (
                        <GoalsEmptyState />
                      ) : (
                        <div className="space-y-4">
                          {kras.map(kra => (
                            <KRACard
                              key={kra.id}
                              kra={kra}
                              kpis={kraOps.getKPIsForKRA(kra.id)}
                              canEdit={kraOps.canEdit(kra.status)}
                              onEditKRA={k => { setEditingKRA(k); setKraFormOpen(true); }}
                              onDeleteKRA={kraOps.deleteKRA}
                              onAddKPI={kraId => { setSelectedKRAId(kraId); setKpiFormOpen(true); }}
                              onEditKPI={kpi => { setEditingKPI(kpi); setSelectedKRAId(kpi.kra_id || null); setKpiFormOpen(true); }}
                              onDeleteKPI={kpiOps.deleteKPI}
                            />
                          ))}

                          {hasDraft && validationIssues.length > 0 && (
                            <ValidationAlert issues={validationIssues} />
                          )}

                          {hasDraft && !allSubmittedOrApproved && (
                            <Button onClick={kraOps.submitForApproval} className="w-full bg-blue-600 hover:bg-blue-700" disabled={!isValid}>
                              <Send className="mr-2 h-4 w-4" />
                              Submit KRAs & KPIs for Approval
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              )}
              {availableQuarters.map(q => {
                // Use goal submission dates for goals, not self-review dates
                const qStarted = hasGoalSubmissionStarted(q);
                const qEnded = hasGoalSubmissionEnded(q);
                const qWorkStatus = canWorkOnGoalsForQuarter(q);
                const startDate = getGoalSubmissionStartDate(q);
                const endDate = getGoalSubmissionEndDate(q);
                const displayStartDate = startDate || getQuarterStartDateFromCycle(activeCycle as CycleWithQuarterDates, q);
                const displayEndDate = endDate || getQuarterEndDateFromCycle(activeCycle as CycleWithQuarterDates, q);
               
                return (
                  <TabsContent key={q} value={`q${q}`} className="space-y-6">
                   {!qStarted ? (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                          <h3 className="font-semibold text-lg">{formatQuarterLabel(q)} Has Not Started Yet</h3>
                          <p className="text-muted-foreground text-center mt-2">
                            {displayStartDate && displayEndDate ? (
                              <>
                                The {formatQuarterLabel(q)} goal setting period will be open from{' '}
                                <span className="font-medium">{formatDateShort(displayStartDate)}</span> to{' '}
                                <span className="font-medium">{formatDateShort(displayEndDate)}</span>.
                              </>
                            ) : (
                              `The ${formatQuarterLabel(q)} goal setting period has not been scheduled yet.`
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Please check back when the quarter begins.
                          </p>
                        </CardContent>
                      </Card>
                    ) : qEnded && !hasLatePermission && !hasActiveTransition ? (
                      <>
                        {/* Show error if period ended, no late permission, and not transition employee */}
                          {endDate && (
                            <PeriodClose quarterNum={q} qEndDate={endDate} title="Goal Setting" />
                          )}
                  
                        {/* Check if goals for this specific quarter are submitted/approved */}
                        {(() => {
                          // Filter goals for this specific quarter
                          const quarterKras = allKras.filter(kra => kra.quarter === q);
                          const quarterKpis = allKpis.filter(kpi => kpi.quarter === q);
                          
                          // Check if at least one goal is submitted/approved
                          const hasSubmittedGoals = quarterKras.some(k => 
                            k.status === 'submitted' || k.status === 'approved' || k.status === 'locked'
                          ) || quarterKpis.some(k => 
                            k.status === 'submitted' || k.status === 'approved' || k.status === 'locked'
                          );
                          
                          // Show submitted/approved goals even if period ended
                          if (hasSubmittedGoals && quarterKras.length > 0) {
                            return (
                            <div className="mt-6 w-full space-y-4">
                                {quarterKras.map(kra => {
                                  const kraKpis = quarterKpis.filter(kpi => kpi.kra_id === kra.id);
                                  return (
                                <KRACard
                                  key={kra.id}
                                  kra={kra}
                                      kpis={kraKpis}
                                      canEdit={false} // Read-only view for submitted/approved goals
                                  onEditKRA={() => {}}
                                  onDeleteKRA={() => {}}
                                  onAddKPI={() => {}}
                                  onEditKPI={() => {}}
                                  onDeleteKPI={() => {}}
                                />
                                  );
                                })}
                            </div>
                            );
                          }
                          return null;
                        })()}
                      </>
                    ) : (
                      <>
                        <GoalStatusAlerts
                          cycle={activeCycle}
                          employeeId={employeeId}
                          isHR={isHR}
                          kras={kras}
                          deadlineStatus={deadlineStatus}
                          hasLatePermission={hasLatePermission}
                        />

                        {qEnded && hasLatePermission && (
                          <Card className="border-amber-200 bg-amber-50">
                            <CardContent className="py-3">
                              <p className="text-sm text-amber-800">
                                <AlertTriangle className="inline h-4 w-4 mr-2" />
                                You have been granted late submission access for {formatQuarterLabel(q)} by HR/Admin.
                              </p>
                            </CardContent>
                          </Card>
                        )}

                        {activeCycle && employeeId && (
                          <>
                            <GoalsProgressCard totalWeight={kraOps.totalKRAWeight} krasCount={kras.length} />

                            {kras.length === 0 ? (
                              <GoalsEmptyState />
                            ) : (
                              <div className="space-y-4">
                                {kras.map(kra => (
                                  <KRACard
                                    key={kra.id}
                                    kra={kra}
                                    kpis={kraOps.getKPIsForKRA(kra.id)}
                                    canEdit={kraOps.canEdit(kra.status)}
                                    onEditKRA={k => { setEditingKRA(k); setKraFormOpen(true); }}
                                    onDeleteKRA={kraOps.deleteKRA}
                                    onAddKPI={kraId => { setSelectedKRAId(kraId); setKpiFormOpen(true); }}
                                    onEditKPI={kpi => { setEditingKPI(kpi); setSelectedKRAId(kpi.kra_id || null); setKpiFormOpen(true); }}
                                    onDeleteKPI={kpiOps.deleteKPI}
                                  />
                                ))}

                                {hasDraft && validationIssues.length > 0 && (
                                  <ValidationAlert issues={validationIssues} />
                                )}

                                {hasDraft && !allSubmittedOrApproved && (
                                  <Button onClick={kraOps.submitForApproval} className="w-full bg-blue-600 hover:bg-blue-700" disabled={!isValid}>
                                    <Send className="mr-2 h-4 w-4" />
                                    Submit KRAs & KPIs for Approval
                                  </Button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </TooltipProvider>
        )}
      </div>

      {/* Form Dialogs */}
      <KRAForm
        open={kraFormOpen}
        onOpenChange={open => { setKraFormOpen(open); if (!open) setEditingKRA(null); }}
        onSubmit={editingKRA
          ? data => kraOps.updateKRA(editingKRA.id, editingKRA.weight, data)
          : kraOps.createKRA}
        editingKRA={editingKRA}
        availableWeight={kraOps.availableKRAWeight}
      />

      <KPIForm
        open={kpiFormOpen}
        onOpenChange={open => { setKpiFormOpen(open); if (!open) { setEditingKPI(null); setSelectedKRAId(null); } }}
        onSubmit={editingKPI
          ? data => kpiOps.updateKPI(editingKPI.id, editingKPI.kra_id!, editingKPI.weight, data)
          : data => selectedKRAId && kpiOps.createKPI(selectedKRAId, data)}
        editingKPI={editingKPI}
        availableWeight={selectedKRAId ? kpiOps.getAvailableKPIWeight(selectedKRAId) : 100}
        kraTitle={selectedKRA?.title || ''}
      />

      {employeeProfile && (
        <TemplateSelector
          open={templateSelectorOpen}
          onOpenChange={setTemplateSelectorOpen}
          employeeDepartment={employeeProfile.department}
          employeeGrade={employeeProfile.grade}
          availableWeight={kraOps.availableKRAWeight}
          onSelectTemplate={templateSelection.selectTemplate}
          onCreateCustom={kraOps.createKRA}
        />
      )}
    </MainLayout>
  );
}
