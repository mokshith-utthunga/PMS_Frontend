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
import { useTeamMemberGoals, useGoalApproval, useTransition } from '@/hooks';
import { useQuarterFromUrl } from '@/hooks/useQuarterFromUrl';
import { getPeriodLabel, getPeriodBadgeVariant, formatPeriodDateRange } from '@/utils/periodHelpers';
import { formatQuarterLabel, getQuarterStartDateFromCycle, getQuarterEndDateFromCycle, formatDateShort, type CycleWithQuarterDates } from '@/utils/quarterHelpers';
import { TOTAL_WEIGHT } from '@/utils/constants';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import type { GoalsQuarterlyCycle } from '@/services/cycle.service';
import { TeamMemberHeader } from '@/components/goals/TeamMemberHeader';
import { TeamMemberKRACard } from '@/components/goals/TeamMemberKRACard';
import { TeamMemberBonusSection } from '@/components/goals/TeamMemberBonusSection';
import { ReturnDialog } from '@/components/goals/ReturnDialog';
import { RevokeDialog } from '@/components/goals/RevokeDialog';
import { goalsService } from '@/services';
import { useToast } from '@/hooks/use-toast';

type ReturnItemType = 'kra' | 'kpi' | 'bonus_kra' | 'bonus_kpi';

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
  const goalsData = useTeamMemberGoals(employeeId, shouldFetchData ? quarter : null);
  const { employee, kras, kpis, bonusKras, bonusKpis, loading, refetch } = goalsData;
  
  // Separate goals by period type
  const preTransitionGoals = useMemo(() => {
    if (!transition) return { kras: [], kpis: [] };
    return {
      kras: kras.filter(k => k.period_type === 'pre_transition' && k.transition_id === transition.id),
      kpis: kpis.filter(k => k.period_type === 'pre_transition' && k.transition_id === transition.id),
    };
  }, [kras, kpis, transition]);
  
  const postTransitionGoals = useMemo(() => {
    if (!transition) return { kras: [], kpis: [] };
    return {
      kras: kras.filter(k => k.period_type === 'post_transition' && k.transition_id === transition.id),
      kpis: kpis.filter(k => k.period_type === 'post_transition' && k.transition_id === transition.id),
    };
  }, [kras, kpis, transition]);
  
  const fullQuarterGoals = useMemo(() => {
    if (transition) return { kras: [], kpis: [] };
    return {
      kras: kras.filter(k => !k.period_type || k.period_type === 'full_quarter'),
      kpis: kpis.filter(k => !k.period_type || k.period_type === 'full_quarter'),
    };
  }, [kras, kpis, transition]);
  
  // Determine which goals to display
  const displayKras = transition ? [...preTransitionGoals.kras, ...postTransitionGoals.kras] : fullQuarterGoals.kras;
  const displayKpis = transition ? [...preTransitionGoals.kpis, ...postTransitionGoals.kpis] : fullQuarterGoals.kpis;

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
    bonusKras,
    bonusKpis,
    onSuccess: refetch,
  });

  const submittedCount = useMemo(() => 
    kras.filter(k => k.status === 'submitted').length +
    kpis.filter(k => k.status === 'submitted').length +
    bonusKras.filter(k => k.status === 'submitted').length +
    bonusKpis.filter(k => k.status === 'submitted').length,
    [kras, kpis, bonusKras, bonusKpis]
  );

  const totalKRAWeight = useMemo(() => 
    kras.reduce((sum, k) => sum + Number(k.weight || 0), 0),
    [kras]
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
      } else {
        // For bonus KRAs and KPIs, use the regular delete endpoint
        // (bonus items don't have revoke endpoints, but we can add them if needed)
        toast({
          title: 'Error',
          description: 'Revoke not supported for bonus items',
          variant: 'destructive',
        });
        return;
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

                    {/* Goals Display - Separated by Period if Transition Exists */}
                    {transition ? (
                      <div className="space-y-6">
                        {/* Pre-Transition Period */}
                        {preTransitionGoals.kras.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Badge variant={getPeriodBadgeVariant('pre_transition')}>
                                {getPeriodLabel('pre_transition')}
                              </Badge>
                              {transition.pre_period_start_date && transition.pre_period_end_date && (
                                <span className="text-sm text-muted-foreground">
                                  {formatPeriodDateRange(transition.pre_period_start_date, transition.pre_period_end_date)}
                                </span>
                              )}
                              <Lock className="h-4 w-4 text-muted-foreground ml-auto" />
                              <span className="text-sm text-muted-foreground">Locked</span>
                            </div>
                            {preTransitionGoals.kras.map(kra => (
                              <TeamMemberKRACard
                                key={kra.id}
                                kra={kra}
                                kpis={approval.getKPIsForKRA(kra.id)}
                                processing={approval.processing}
                                onApprove={approval.approveKRA}
                                onReturn={handleOpenReturnDialog}
                                onRevoke={handleOpenRevokeDialog}
                              />
                            ))}
                          </div>
                        )}

                        {/* Transition Separator */}
                        {preTransitionGoals.kras.length > 0 && postTransitionGoals.kras.length > 0 && (
                          <div className="flex items-center gap-2 py-2">
                            <div className="flex-1 border-t"></div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline">{formatDateShort(new Date(transition.transition_date))}</Badge>
                            <div className="flex-1 border-t"></div>
                          </div>
                        )}

                        {/* Post-Transition Period */}
                        {postTransitionGoals.kras.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Badge variant={getPeriodBadgeVariant('post_transition')}>
                                {getPeriodLabel('post_transition')}
                              </Badge>
                              {transition.post_period_start_date && transition.post_period_end_date && (
                                <span className="text-sm text-muted-foreground">
                                  {formatPeriodDateRange(transition.post_period_start_date, transition.post_period_end_date)}
                                </span>
                              )}
                            </div>
                            {postTransitionGoals.kras.map(kra => (
                              <TeamMemberKRACard
                                key={kra.id}
                                kra={kra}
                                kpis={approval.getKPIsForKRA(kra.id)}
                                processing={approval.processing}
                                onApprove={approval.approveKRA}
                                onReturn={handleOpenReturnDialog}
                                onRevoke={handleOpenRevokeDialog}
                              />
                            ))}
                          </div>
                        )}

                        {/* No Goals Message for Transition */}
                        {preTransitionGoals.kras.length === 0 && postTransitionGoals.kras.length === 0 && (
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
                      </div>
                    ) : (
                      /* Full Quarter Goals (No Transition) */
                      <>
                        {displayKras.length === 0 ? (
                          <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                              <Target className="h-12 w-12 text-muted-foreground mb-4" />
                              <h3 className="font-semibold text-lg">No KRAs submitted</h3>
                              <p className="text-muted-foreground">
                                This employee hasn't submitted any KRAs for {formatQuarterLabel(q)}
                              </p>
                            </CardContent>
                          </Card>
                        ) : (
                          <div className="space-y-4">
                            {displayKras.map(kra => (
                              <TeamMemberKRACard
                                key={kra.id}
                                kra={kra}
                                kpis={approval.getKPIsForKRA(kra.id)}
                                processing={approval.processing}
                                onApprove={approval.approveKRA}
                                onReturn={handleOpenReturnDialog}
                                onRevoke={handleOpenRevokeDialog}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Bonus KRAs Section */}
                    <TeamMemberBonusSection
                      bonusKras={bonusKras}
                      getBonusKPIsForKRA={approval.getBonusKPIsForKRA}
                      processing={approval.processing}
                      onApprove={approval.approveBonusKRA}
                      onReturn={handleOpenReturnDialog}
                    />
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
