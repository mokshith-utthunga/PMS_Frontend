// Team Member Goals Page - Manager view for goal approval
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Target, Lock, ArrowRight } from 'lucide-react';
import { PageLoader } from '@/loaders';
import { useTeamMemberGoals, useGoalApproval, useTransition, useCurrentEmployee } from '@/hooks';
import { useQuarterFromUrl } from '@/hooks/useQuarterFromUrl';
import { getPeriodLabel, getPeriodBadgeVariant, formatPeriodDateRange } from '@/utils/periodHelpers';
import { formatQuarterLabel, getQuarterStartDateFromCycle, getQuarterEndDateFromCycle, formatDateShort, type CycleWithQuarterDates } from '@/utils/quarterHelpers';
import { TOTAL_WEIGHT } from '@/utils/constants';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import type { GoalsQuarterlyCycle } from '@/services/cycle.service';
import { TeamMemberHeader } from '@/components/goals/TeamMemberHeader';
import { TeamMemberKRACard } from '@/components/goals/TeamMemberKRACard';
import { ReturnDialog } from '@/components/goals/ReturnDialog';
import { RevokeDialog } from '@/components/goals/RevokeDialog';
import { goalsService } from '@/services';
import { useToast } from '@/hooks/use-toast';

type ReturnItemType = 'kra' | 'kpi';

interface ReturnDialogState {
  open: boolean;
  type: ReturnItemType | null;
  id: string | null;
}

interface RevokeDialogState {
  open: boolean;
  type: ReturnItemType | null;
  id: string | null;
}

export default function TeamMemberGoals() {
  const { employeeId } = useParams();
  
  // Get current manager's employee data
  const { employee: currentManager } = useCurrentEmployee();
  
  // Get active cycle data from context (fetched once at app initialization)
  const { activeCycle, goalsQuarterlyCycles: goalsQuarterlyCyclesFromContext, isLoading: isLoadingCycle } = useActiveCycle();
  const goalsQuarterlyCycles = (goalsQuarterlyCyclesFromContext || []) as GoalsQuarterlyCycle[];
  
  // Helper functions for goal submission dates
  const getGoalSubmissionStartDate = useCallback((quarter: number): Date | null => {
    const quarterNum = typeof quarter === 'string' ? parseInt(quarter) : quarter;
    const goalsCycle = goalsQuarterlyCycles.find((gqc: GoalsQuarterlyCycle) => {
      const gqcQuarter = typeof gqc.quarter === 'string' ? parseInt(gqc.quarter) : gqc.quarter;
      return gqcQuarter === quarterNum;
    });
    if (goalsCycle?.goal_submission_start_date) {
      return new Date(goalsCycle.goal_submission_start_date);
    }
    return null;
  }, [goalsQuarterlyCycles]);

  const getGoalSubmissionEndDate = useCallback((quarter: number): Date | null => {
    const quarterNum = typeof quarter === 'string' ? parseInt(quarter) : quarter;
    const goalsCycle = goalsQuarterlyCycles.find((gqc: GoalsQuarterlyCycle) => {
      const gqcQuarter = typeof gqc.quarter === 'string' ? parseInt(gqc.quarter) : gqc.quarter;
      return gqcQuarter === quarterNum;
    });
    if (goalsCycle?.goal_submission_end_date) {
      return new Date(goalsCycle.goal_submission_end_date);
    }
    return null;
  }, [goalsQuarterlyCycles]);

  // Helper to check if goal submission period has started for a quarter
  const hasGoalSubmissionStarted = useCallback((quarter: number): boolean => {
    // Ensure quarter is a number for comparison
    const quarterNum = typeof quarter === 'string' ? parseInt(quarter) : quarter;
    
    const goalsCycle = goalsQuarterlyCycles.find((gqc: GoalsQuarterlyCycle) => {
      // Handle both string and number quarter values
      const gqcQuarter = typeof gqc.quarter === 'string' ? parseInt(gqc.quarter) : gqc.quarter;
      return gqcQuarter === quarterNum;
    });
    
    if (!goalsCycle?.goal_submission_start_date) {
      return false;
    }
    
    const startDate = new Date(goalsCycle.goal_submission_start_date);
    const now = new Date();
    
    startDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    
    return now >= startDate;
  }, [goalsQuarterlyCycles]);
  
  const { quarter, setQuarter, isValidQuarter } = useQuarterFromUrl();
  // Track nested tab within quarter: 'pre-transition' or 'transition'
  // Default depends on manager role: new_manager defaults to 'transition', same_manager defaults to 'pre-transition'
  const [nestedTab, setNestedTab] = useState<'pre-transition' | 'transition'>('pre-transition');
  // isTransitionTab is true when nestedTab is 'transition'
  const isTransitionTab = nestedTab === 'transition';
  
  const availableQuarters: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
  
  const firstStartedQuarter = useMemo(() => {
    for (const q of availableQuarters) {
      if (hasGoalSubmissionStarted(q)) {
        return q;
      }
    }
    return null;
  }, [hasGoalSubmissionStarted]);
  
  // Set default quarter to first started quarter if not in URL
  useEffect(() => {
    if (!isValidQuarter && !quarter && firstStartedQuarter) {
      setQuarter(firstStartedQuarter);
    }
  }, [isValidQuarter, quarter, setQuarter, firstStartedQuarter]);
  
  // Auto-switch to first started quarter if selected quarter hasn't started
  useEffect(() => {
    if (quarter && !hasGoalSubmissionStarted(quarter) && firstStartedQuarter) {
      setQuarter(firstStartedQuarter);
    }
  }, [quarter, firstStartedQuarter, setQuarter, hasGoalSubmissionStarted]);
  
  // Only fetch data if quarter has started
  const shouldFetchData = quarter ? hasGoalSubmissionStarted(quarter) : false;
  
  // Fetch transition data for the current quarter
  const { transition, loading: transitionLoading } = useTransition({
    employeeId,
    cycleId: activeCycle?.id,
    quarter: shouldFetchData ? quarter : null,
    enabled: shouldFetchData && !!employeeId && !!activeCycle,
  });
  
  // Fetch team member goals data with quarter filter (only if quarter has started)
  // Pass periodType and transition_id based on the active nested tab
  // Only apply periodType filtering for transitioned employees (when transition exists)
  // Pre-transition tab: pass periodType='pre_transition' to get pre-transition goals
  // Transition tab: pass periodType='post_transition' and transition_id to get post-transition goals
  const shouldUseTransitionId = isTransitionTab && transition && transition.quarter === quarter;
  // Only set periodType if employee has a transition for this quarter
  const periodType = transition && transition.quarter === quarter
    ? (isTransitionTab ? 'post_transition' : 'pre_transition')
    : undefined; // For non-transitioned employees, don't pass periodType
  const goalsData = useTeamMemberGoals(
    employeeId, 
    shouldFetchData ? quarter : null, 
    periodType, // Pass periodType only for transitioned employees
    shouldUseTransitionId // useTransitionId - only use transition_id when in transition nested tab
  );
  const { employee, kras, kpis, loading, refetch } = goalsData;
  
  // No frontend filtering - display goals directly from API response
  // API handles filtering based on transition_id parameter:
  // - Without transition_id: returns all goals (pre + post + full_quarter)
  // - With transition_id: returns post-transition goals only
  
  // Display goals directly from API - no filtering needed
  const displayKras = kras;
  const displayKpis = kpis;
  
  // Determine manager role for display purposes
  // If new_manager_id is null or empty, it is considered as the same manager
  // Case 1: If old_manager_id ≠ new_manager_id (different managers)
  //   - Old manager: see ONLY pre-transition goals (NOT post-transition goals)
  //   - New manager: see ONLY post-transition goals
  // Case 2: If new_manager_id is null/empty OR equals old_manager_id (same manager)
  //   - Manager: see both pre and post-transition data
  const managerRole = useMemo(() => {
    if (!transition || !currentManager || !transition.old_manager_id) {
      return null; // No transition or no current manager
    }
    if (transition.employee_id !== employeeId) return null;

    const isOldManager = transition.old_manager_id === currentManager.id;
    // If new_manager_id is null or empty, it is considered as the same manager
    const isNewManagerIdEmpty = !transition.new_manager_id || transition.new_manager_id === '';
    const isNewManager = transition.new_manager_id && transition.new_manager_id === currentManager.id;
    
    // If new_manager_id is null/empty, treat as same manager
    if (isNewManagerIdEmpty) {
      if (isOldManager) {
        return 'same_manager'; // Manager didn't change, so it's the same manager
      } else {
        return null; // Not involved in this transition
      }
    }
    
    const managersAreDifferent = transition.new_manager_id && 
                                  transition.new_manager_id !== transition.old_manager_id;

    if (managersAreDifferent) {
      // Different managers: show only relevant period
      if (isOldManager) {
        return 'old_manager'; // See ONLY pre-transition goals
      } else if (isNewManager) {
        return 'new_manager'; // See ONLY post-transition goals
      } else {
        return null; // Not involved in this transition
      }
    } else {
      // Same manager (new_manager_id equals old_manager_id)
      if (isOldManager || isNewManager) {
        return 'same_manager'; // See both pre and post-transition
      } else {
        return null; // Not involved in this transition
      }
    }
  }, [transition, currentManager, employeeId]);
  
  // Update nested tab default based on manager role
  useEffect(() => {
    if (transition && quarter === transition.quarter) {
      if (managerRole === 'new_manager') {
        // New manager should default to transition tab (post-transition goals)
        setNestedTab('transition');
      } else if (managerRole === 'same_manager') {
        // Same manager can see both, default to pre-transition
        setNestedTab('pre-transition');
      }
      // old_manager doesn't see nested tabs, so no need to set
    }
  }, [managerRole, transition, quarter]);
  
  // Legacy: Keep isNewManager for backward compatibility
  const isNewManager = managerRole === 'new_manager';

  const { toast } = useToast();
  
  // Return dialog state
  const [returnDialog, setReturnDialog] = useState<ReturnDialogState>({
    open: false,
    type: null,
    id: null,
  });

  // Revoke dialog state
  const [revokeDialog, setRevokeDialog] = useState<RevokeDialogState>({
    open: false,
    type: null,
    id: null,
  });

  const approval = useGoalApproval({
    employee,
    kras,
    kpis,
    onSuccess: refetch,
  });

  // Calculate submitted count based on displayed goals (current nested tab)
  // Only count submitted goals that are visible in the current nested tab
  const submittedCount = useMemo(() => {
    // Only show approve all button in transition nested tab
    if (!isTransitionTab) return 0;
    
    // Count submitted goals from the displayed goals (post-transition for transition nested tab)
    return displayKras.filter(k => k.status === 'submitted').length +
           displayKpis.filter(k => k.status === 'submitted').length;
  }, [displayKras, displayKpis, isTransitionTab]);

  const totalKRAWeight = useMemo(() => 
    displayKras.reduce((sum, k) => sum + Number(k.weight || 0), 0),
    [displayKras]
  );

  // Handlers
  const handleOpenReturnDialog = (type: ReturnItemType, id: string) => {
    setReturnDialog({ open: true, type, id });
  };

  const handleCloseReturnDialog = () => {
    setReturnDialog({ open: false, type: null, id: null });
  };

  const handleReturn = async (comments: string) => {
    if (!returnDialog.type || !returnDialog.id) return false;
    return approval.returnItem(returnDialog.type, returnDialog.id, comments);
  };

  const handleOpenRevokeDialog = (type: ReturnItemType, id: string) => {
    setRevokeDialog({ open: true, type, id });
  };

  const handleCloseRevokeDialog = () => {
    setRevokeDialog({ open: false, type: null, id: null });
  };

  const handleRevoke = async () => {
    if (!revokeDialog.type || !revokeDialog.id) return;

    try {
      if (revokeDialog.type === 'kra') {
        await goalsService.kras.revoke(revokeDialog.id);
        toast({
          title: 'Success',
          description: 'Approved KRA revoked and deleted successfully',
        });
      } else if (revokeDialog.type === 'kpi') {
        await goalsService.kpis.revoke(revokeDialog.id);
        toast({
          title: 'Success',
          description: 'Approved KPI revoked and deleted successfully',
        });
      }
      
      await refetch();
      handleCloseRevokeDialog();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke approved goal',
        variant: 'destructive',
      });
    }
  };

  // Loading state
  if (loading || isLoadingCycle || transitionLoading) {
    return (
      <MainLayout>
        <PageLoader />
      </MainLayout>
    );
  }

  if (!employee) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Employee not found</AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <TeamMemberHeader
          employee={employee}
          submittedCount={submittedCount}
          processing={approval.processing}
          onApproveAll={approval.approveAll}
        />

        {/* Quarter Tabs */}
        <TooltipProvider>
          <Tabs 
            value={quarter ? `q${quarter}` : 'q1'} 
            onValueChange={(value) => {
              const q = parseInt(value.replace('q', ''));
              if (q >= 1 && q <= 4) {
                // Only allow switching to quarters that have started
                if (hasGoalSubmissionStarted(q)) {
                  setQuarter(q as 1 | 2 | 3 | 4);
                  // Reset nested tab based on manager role when switching quarters
                  // This will be updated by the useEffect when transition data loads
                }
              }
            }}
          >
            <TabsList>
              {availableQuarters.map(q => {
                const qStarted = hasGoalSubmissionStarted(q);
                const startDate = getGoalSubmissionStartDate(q) || getQuarterStartDateFromCycle(activeCycle as CycleWithQuarterDates, q);
                const endDate = getGoalSubmissionEndDate(q) || getQuarterEndDateFromCycle(activeCycle as CycleWithQuarterDates, q);
                
                if (!qStarted) {
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
                  <TabsTrigger key={q} value={`q${q}`}>
                    {formatQuarterLabel(q)}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          
          {availableQuarters.map(q => {
            const qStarted = hasGoalSubmissionStarted(q);
            const startDate = getGoalSubmissionStartDate(q) || getQuarterStartDateFromCycle(activeCycle as CycleWithQuarterDates, q);
            const endDate = getGoalSubmissionEndDate(q) || getQuarterEndDateFromCycle(activeCycle as CycleWithQuarterDates, q);
            
            // Check if this quarter has a transition
            const quarterTransition = transition && transition.quarter === q ? transition : null;
            // Only show nested tabs for new_manager (old_manager should NOT see post-transition goals)
            // For same_manager, show nested tabs if transition exists
            const hasTransition = quarterTransition && (managerRole === 'new_manager' || managerRole === 'same_manager');
            
            return (
              <TabsContent key={q} value={`q${q}`} className="space-y-6">
                {/* Show message if quarter hasn't started */}
                {!qStarted ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Target className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-semibold text-lg">{formatQuarterLabel(q)} Has Not Started Yet</h3>
                      <p className="text-muted-foreground text-center mt-2">
                        {startDate && endDate ? (
                          <>
                            The {formatQuarterLabel(q)} goal setting period will be open from{' '}
                            <span className="font-medium">{formatDateShort(startDate)}</span> to{' '}
                            <span className="font-medium">{formatDateShort(endDate)}</span>.
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
                ) : (
                  <>
                    {/* Nested Tabs for Pre-Transition and Transition (if transition exists) */}
                    {hasTransition ? (
                      <Tabs 
                        value={q === quarter ? nestedTab : 'pre-transition'} 
                        onValueChange={(value) => {
                          if (q === quarter) {
                            setNestedTab(value as 'pre-transition' | 'transition');
                          }
                        }}
                        className="space-y-6"
                      >
                        <TabsList>
                          {managerRole === 'same_manager' && (
                            <TabsTrigger value="pre-transition">Pre-Transition</TabsTrigger>
                          )}
                          <TabsTrigger value="transition">Transition</TabsTrigger>
                        </TabsList>
                        
                        {/* Pre-Transition Tab Content - Only for same_manager */}
                        {managerRole === 'same_manager' && (
                          <TabsContent value="pre-transition" className="space-y-6">
                            {q === quarter && nestedTab === 'pre-transition' && (
                            <>
                              {/* Transition Alert */}
                              {quarterTransition && (
                                <Alert>
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <span className="font-semibold">Mid-Quarter Transition Detected</span>
                                        <p className="text-sm text-muted-foreground mt-1">
                                          Transition Date: {formatDateShort(new Date(quarterTransition.transition_date))} • 
                                          Type: {quarterTransition.transition_type}
                                        </p>
                                      </div>
                                      <Badge variant={getPeriodBadgeVariant('pre_transition')}>
                                        {getPeriodLabel('pre_transition')}
                                      </Badge>
                                    </div>
                                  </AlertDescription>
                                </Alert>
                              )}

                              {/* Weight Summary */}
                              <Card>
                                <CardContent className="pt-6">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <span className="text-sm font-medium">Total KRA Weight: </span>
                                      <span className={`font-bold ${totalKRAWeight === TOTAL_WEIGHT ? 'text-primary' : 'text-destructive'}`}>
                                        {totalKRAWeight}%
                                      </span>
                                    </div>
                                    <div className="flex gap-4 text-sm">
                                      <span>
                                        Approved: <Badge variant="outline">{displayKras.filter(k => k.status === 'approved').length} KRAs</Badge>
                                      </span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Pre-Transition Goals Display */}
                              {displayKras.length > 0 ? (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={getPeriodBadgeVariant('pre_transition')}>
                                      {getPeriodLabel('pre_transition')}
                                    </Badge>
                                    {quarterTransition?.pre_period_start_date && quarterTransition?.pre_period_end_date && (
                                      <span className="text-sm text-muted-foreground">
                                        {formatPeriodDateRange(quarterTransition.pre_period_start_date, quarterTransition.pre_period_end_date)}
                                      </span>
                                    )}
                                  </div>
                                  {displayKras.map(kra => (
                                    <TeamMemberKRACard
                                      key={kra.id}
                                      kra={kra}
                                      kpis={displayKpis.filter(kpi => kpi.kra_id === kra.id)}
                                      processing={approval.processing}
                                      onApprove={approval.approveKRA}
                                      onReturn={handleOpenReturnDialog}
                                      onRevoke={handleOpenRevokeDialog}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <Card>
                                  <CardContent className="flex flex-col items-center justify-center py-12">
                                    <Target className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="font-semibold text-lg">No Pre-Transition KRAs</h3>
                                    <p className="text-muted-foreground">
                                      This employee hasn't submitted any KRAs for the pre-transition period in {formatQuarterLabel(q)}
                                    </p>
                                  </CardContent>
                                </Card>
                              )}
                            </>
                            )}
                          </TabsContent>
                        )}
                        
                        {/* Transition Tab Content - For new_manager and same_manager */}
                        <TabsContent value="transition" className="space-y-6">
                          {q === quarter && nestedTab === 'transition' && (
                            <>
                              <Card className="border-blue-200 bg-blue-50">
                                <CardContent className="py-4">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-1">
                                      <h3 className="font-semibold text-lg mb-1">Post-Transition Goals</h3>
                                      <p className="text-sm text-muted-foreground">
                                        Transition occurred on {quarterTransition?.transition_date ? formatDateShort(new Date(quarterTransition.transition_date)) : 'N/A'}. 
                                        {managerRole === 'new_manager' && ' These are the goals you will review as the new manager.'}
                                        {managerRole === 'same_manager' && ' These are the goals set after the transition.'}
                                      </p>
                                      {quarterTransition?.new_manager_name && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                          New Manager: <span className="font-medium">{quarterTransition.new_manager_name}</span>
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Weight Summary */}
                              <Card>
                                <CardContent className="pt-6">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <span className="text-sm font-medium">Total KRA Weight: </span>
                                      <span className={`font-bold ${totalKRAWeight === TOTAL_WEIGHT ? 'text-primary' : 'text-destructive'}`}>
                                        {totalKRAWeight}%
                                      </span>
                                    </div>
                                    <div className="flex gap-4 text-sm">
                                      <span>
                                        Approved: <Badge variant="outline">{displayKras.filter(k => k.status === 'approved').length} KRAs</Badge>
                                      </span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Post-Transition Goals */}
                              {displayKras.length > 0 ? (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={getPeriodBadgeVariant('post_transition')}>
                                      {getPeriodLabel('post_transition')}
                                    </Badge>
                                    {quarterTransition?.post_period_start_date && quarterTransition?.post_period_end_date && (
                                      <span className="text-sm text-muted-foreground">
                                        {formatPeriodDateRange(quarterTransition.post_period_start_date, quarterTransition.post_period_end_date)}
                                      </span>
                                    )}
                                  </div>
                                  {displayKras.map(kra => (
                                    <TeamMemberKRACard
                                      key={kra.id}
                                      kra={kra}
                                      kpis={displayKpis.filter(kpi => kpi.kra_id === kra.id)}
                                      processing={approval.processing}
                                      onApprove={approval.approveKRA}
                                      onReturn={handleOpenReturnDialog}
                                      onRevoke={handleOpenRevokeDialog}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <Card>
                                  <CardContent className="flex flex-col items-center justify-center py-12">
                                    <Target className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="font-semibold text-lg">No Post-Transition KRAs</h3>
                                    <p className="text-muted-foreground">
                                      This employee hasn't submitted any KRAs for the post-transition period
                                    </p>
                                  </CardContent>
                                </Card>
                              )}
                            </>
                          )}
                        </TabsContent>
                      </Tabs>
                    ) : (
                      /* No Transition - Show regular goals */
                      <>
                        {/* Weight Summary */}
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="text-sm font-medium">Total KRA Weight: </span>
                                <span className={`font-bold ${totalKRAWeight === TOTAL_WEIGHT ? 'text-primary' : 'text-destructive'}`}>
                                  {totalKRAWeight}%
                                </span>
                              </div>
                              <div className="flex gap-4 text-sm">
                                <span>
                                  Approved: <Badge variant="outline">{displayKras.filter(k => k.status === 'approved').length} KRAs</Badge>
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Goals Display - Direct from API, no frontend filtering */}
                        {displayKras.length > 0 ? (
                          <div className="space-y-4">
                            {displayKras.map(kra => (
                              <TeamMemberKRACard
                                key={kra.id}
                                kra={kra}
                                kpis={displayKpis.filter(kpi => kpi.kra_id === kra.id)}
                                processing={approval.processing}
                                onApprove={approval.approveKRA}
                                onReturn={handleOpenReturnDialog}
                                onRevoke={handleOpenRevokeDialog}
                              />
                            ))}
                          </div>
                        ) : (
                          <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                              <Target className="h-12 w-12 text-muted-foreground mb-4" />
                              <h3 className="font-semibold text-lg">No KRAs submitted</h3>
                              <p className="text-muted-foreground">
                                This employee hasn't submitted any KRAs for {formatQuarterLabel(q)}
                              </p>
                            </CardContent>
                          </Card>
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

        {/* Return Dialog */}
        <ReturnDialog
          open={returnDialog.open}
          type={returnDialog.type}
          processing={approval.processing}
          onClose={handleCloseReturnDialog}
          onSubmit={handleReturn}
        />

        {/* Revoke Dialog */}
        <RevokeDialog
          open={revokeDialog.open}
          type={revokeDialog.type}
          processing={approval.processing}
          onClose={handleCloseRevokeDialog}
          onConfirm={handleRevoke}
        />
      </div>
    </MainLayout>
  );
}
