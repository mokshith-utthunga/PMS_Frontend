// Goals Page - Refactored with hooks and services
import { useState, useMemo, useEffect } from 'react';
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
import { useGoalsData, useKraOperations, useKpiOperations, useBonusOperations, useTemplateSelection, useCurrentEmployee } from '@/hooks';
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
import { BonusKRAForm } from '@/components/goals/BonusKRAForm';
import { BonusKPIForm } from '@/components/goals/BonusKPIForm';
import { employeeService, goalsService } from '@/services';
import { toasts } from '@/toasts';
import type { KRA, Goal, BonusKRA, BonusKPI, Employee } from '@/types';
import type { GoalsQuarterlyCycle } from '@/services/cycle.service';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import PeriodClose from '@/components/evaluation/PeriodClose';

export default function Goals() {
  const { user, hasAnyRole } = useAuth();
  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin', 'dept_head', 'manager']);

  // URL-based quarter handling
  const { quarter, setQuarter, isValidQuarter } = useQuarterFromUrl();

  // Get current employee from cached hook (fetched once at app initialization)
  const { employee, isLoading: loadingEmployee } = useCurrentEmployee();

  // Get active cycle data from context (fetched once at app initialization)
  const { activeCycle: activeCycleFromContext, goalsQuarterlyCycles: goalsQuarterlyCyclesFromContext } = useActiveCycle();

  // Fetch all goals data with quarter filter
  const goalsData = useGoalsData(user?.id, quarter || null);
  const { employeeId, employeeProfile, kras, kpis, bonusKras, bonusKpis, hasLatePermission, loading, refetch } = goalsData;

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

  // Helper to check if employee can work on goals for a quarter
  const canWorkOnGoalsForQuarter = (quarter: number): { canWork: boolean; reason: 'not_started' | 'ended' | 'ok' } => {
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

  // Set default quarter if not in URL - find first quarter where goal submission has started
  // Always prefer Q1, Q2, Q3, Q4 in order (not based on availableQuarters order)
  useEffect(() => {
    if (!loadingEmployee && !isValidQuarter && availableQuarters.length > 0 && activeCycle && goalsQuarterlyCycles.length > 0) {
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
    } else if (!loadingEmployee && !isValidQuarter && availableQuarters.length > 0 && activeCycle) {
      // Fallback if goalsQuarterlyCycles not loaded yet - find first available quarter in order
      for (let q = 1; q <= 4; q++) {
        if (availableQuarters.includes(q as 1 | 2 | 3 | 4)) {
          setQuarter(q as 1 | 2 | 3 | 4);
          return;
        }
      }
    }
  }, [loadingEmployee, isValidQuarter, availableQuarters, activeCycle, goalsQuarterlyCycles, setQuarter, hasGoalSubmissionStarted]);

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
  const [bonusKraFormOpen, setBonusKraFormOpen] = useState(false);
  const [editingBonusKRA, setEditingBonusKRA] = useState<BonusKRA | null>(null);
  const [bonusKpiFormOpen, setBonusKpiFormOpen] = useState(false);
  const [editingBonusKPI, setEditingBonusKPI] = useState<BonusKPI | null>(null);
  const [selectedBonusKRAId, setSelectedBonusKRAId] = useState<string | null>(null);

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
        refetch();
      }
    } catch (error: any) {
      toasts.error('Clone Failed', error.message || 'Failed to clone goals');
    }
  };

  // KRA Operations
  const kraOps = useKraOperations({
    employeeId,
    cycleId: activeCycle?.id || null,
    kras,
    kpis,
    onSuccess: refetch,
    quarter: quarter || null,
  });

  // KPI Operations
  const kpiOps = useKpiOperations({
    employeeId,
    cycleId: activeCycle?.id || null,
    kpis,
    onSuccess: refetch,
    quarter: quarter || null,
  });

  // Bonus Operations
  const bonusOps = useBonusOperations({
    employeeId,
    cycleId: activeCycle?.id || null,
    bonusKras,
    bonusKpis,
    onSuccess: refetch,
  });

  // Template Selection
  const templateSelection = useTemplateSelection({
    employeeId,
    cycleId: activeCycle?.id || null,
    krasCount: kras.length,
    availableKRAWeight: kraOps.availableKRAWeight,
    onSuccess: refetch,
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
  }, [quarter, activeCycle, hasLatePermission, goalsQuarterlyCycles]);


  const canSubmit = quarterWorkStatus.canWork || (deadlineStatus?.canSubmit ?? false);

  const quarterHasStarted = useMemo(() => {
    if (!quarter || !activeCycle) return false;
    return hasGoalSubmissionStarted(quarter);
  }, [quarter, activeCycle, goalsQuarterlyCycles]);

  const quarterHasEnded = useMemo(() => {
    if (!quarter || !activeCycle) return false;
    return hasGoalSubmissionEnded(quarter);
  }, [quarter, activeCycle, goalsQuarterlyCycles]);

  const showAddButton = activeCycle && employeeId && kras.length < 5 && canSubmit && quarterWorkStatus.canWork;
  const showCloneButton = previousQuarters.length > 0 && quarter && quarterWorkStatus.canWork;
  const hasDraft = hasDraftItems(kras, kpis);
  const isValid = isValidForSubmission(kras, kpis, kraOps.getKPIsForKRA);
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
            <Tabs value={quarter ? `q${quarter}` : undefined} onValueChange={(value) => {
              const q = parseInt(value.replace('q', ''));
              if (q >= 1 && q <= 4) {
                // Only allow changing to quarters where goal submission has started
                const goalStarted = hasGoalSubmissionStarted(q);
                if (goalStarted) {
                  setQuarter(q as 1 | 2 | 3 | 4);
                }
              }
            }}>
              <TabsList>
                {availableQuarters.map(q => {
                  // Use goal submission dates for goals
                  const goalStarted = hasGoalSubmissionStarted(q);
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
                    <TabsTrigger key={q} value={`q${q}`}>
                      {formatQuarterLabel(q)}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
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
                    ) : qEnded && !hasLatePermission ? (<>
                          {/* <div className='flex flex-row items-start justify-start gap-2 bg-red-300 p-2'>
                          <AlertTriangle className="h-12 w-12 text-amber-700 mr-2" />
                          <h3 className="font-normal text-lg my-auto text-black">{formatQuarterLabel(q)} Goal Setting Period Has Ended</h3>
                          </div> */}
                          {endDate && (
                            <PeriodClose quarterNum={q} qEndDate={endDate} title="Goal Setting" />
                          )}
                  
                        {/* <div>
                          {kras.length > 0 && (
                            <div className="mt-6 w-full space-y-4">
                              {kras.map(kra => (
                                <KRACard
                                  key={kra.id}
                                  kra={kra}
                                  kpis={kraOps.getKPIsForKRA(kra.id)}
                                  canEdit={false}
                                  onEditKRA={() => {}}
                                  onDeleteKRA={() => {}}
                                  onAddKPI={() => {}}
                                  onEditKPI={() => {}}
                                  onDeleteKPI={() => {}}
                                />
                              ))}
                            </div>
                          )}
                        </div> */}
             
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

                                {hasDraft && (
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

      <BonusKRAForm
        open={bonusKraFormOpen}
        onOpenChange={open => { setBonusKraFormOpen(open); if (!open) setEditingBonusKRA(null); }}
        onSubmit={editingBonusKRA
          ? data => bonusOps.updateBonusKRA(editingBonusKRA.id, data)
          : bonusOps.createBonusKRA}
        editingBonusKRA={editingBonusKRA}
      />

      <BonusKPIForm
        open={bonusKpiFormOpen}
        onOpenChange={open => { setBonusKpiFormOpen(open); if (!open) { setEditingBonusKPI(null); setSelectedBonusKRAId(null); } }}
        onSubmit={editingBonusKPI
          ? data => bonusOps.updateBonusKPI(editingBonusKPI.id, data)
          : data => selectedBonusKRAId && bonusOps.createBonusKPI(selectedBonusKRAId, data)}
        editingBonusKPI={editingBonusKPI}
        bonusKraTitle={bonusKras.find(b => b.id === selectedBonusKRAId)?.title || ''}
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
