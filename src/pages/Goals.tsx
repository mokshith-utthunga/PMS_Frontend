// Goals Page - Refactored with hooks and services
import { useState, useMemo, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Send, Copy, ChevronDown, Calendar, Lock, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageLoader } from '@/loaders';
import { useGoalsData, useKraOperations, useKpiOperations, useBonusOperations, useTemplateSelection } from '@/hooks';
import { useQuarterFromUrl } from '@/hooks/useQuarterFromUrl';
import { getGoalDeadlineStatus } from '@/utils/deadlineUtils';
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

export default function Goals() {
  const { user, hasAnyRole } = useAuth();
  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin','dept_head','manager']);

  // URL-based quarter handling
  const { quarter, setQuarter, isValidQuarter } = useQuarterFromUrl();
  
  // Fetch employee data for join date
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loadingEmployee, setLoadingEmployee] = useState(true);

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const result = await employeeService.getMe();
        if (result.data) {
          setEmployee(result.data);
        }
      } catch (error) {
        console.error('Error fetching employee:', error);
      } finally {
        setLoadingEmployee(false);
      }
    };
    if (user?.id) {
      fetchEmployee();
    }
  }, [user?.id]);

  // Fetch all goals data with quarter filter
  const goalsData = useGoalsData(user?.id, quarter || null);
  const { employeeId, employeeProfile, activeCycle, kras, kpis, bonusKras, bonusKpis, hasLatePermission, loading, refetch } = goalsData;

  // Get available quarters based on join date
  const availableQuarters = useMemo(() => {
    if (!employee || !activeCycle) return [];
    return getAvailableQuartersForEmployee(employee, activeCycle);
  }, [employee, activeCycle]);

  // Set default quarter if not in URL
  useEffect(() => {
    if (!loadingEmployee && !isValidQuarter && availableQuarters.length > 0 && activeCycle) {
      // Set to first available quarter
      setQuarter(availableQuarters[0]);
    }
  }, [loadingEmployee, isValidQuarter, availableQuarters, activeCycle, setQuarter]);

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
  });

  // Computed values
  const deadlineStatus = useMemo(
    () => getGoalDeadlineStatus(activeCycle, hasLatePermission),
    [activeCycle, hasLatePermission]
  );

  const validationIssues = useMemo(
    () => getValidationIssues(kras, kpis, kraOps.getKPIsForKRA),
    [kras, kpis, kraOps.getKPIsForKRA]
  );

  const canSubmit = deadlineStatus?.canSubmit ?? false;
  
  const quarterWorkStatus = useMemo(() => {
    if (!quarter || !activeCycle) return { canWork: false, reason: 'not_started' as const };
    return canWorkOnQuarter(activeCycle as CycleWithQuarterDates, quarter, hasLatePermission);
  }, [quarter, activeCycle, hasLatePermission]);

  const quarterHasStarted = useMemo(() => {
    if (!quarter || !activeCycle) return false;
    return hasQuarterStarted(activeCycle as CycleWithQuarterDates, quarter);
  }, [quarter, activeCycle]);

  const quarterHasEnded = useMemo(() => {
    if (!quarter || !activeCycle) return false;
    return hasQuarterEnded(activeCycle as CycleWithQuarterDates, quarter);
  }, [quarter, activeCycle]);

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
                // Only allow changing to quarters that have started
                const quarterHasStarted = hasQuarterStarted(activeCycle as CycleWithQuarterDates, q);
                if (quarterHasStarted) {
                  setQuarter(q as 1 | 2 | 3 | 4);
                }
              }
            }}>
              <TabsList>
                {availableQuarters.map(q => {
                  const quarterHasStarted = hasQuarterStarted(activeCycle as CycleWithQuarterDates, q);
                  const startDate = getQuarterStartDateFromCycle(activeCycle as CycleWithQuarterDates, q);
                  const endDate = getQuarterEndDateFromCycle(activeCycle as CycleWithQuarterDates, q);
                  
                  if (!quarterHasStarted) {
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
                const qStarted = hasQuarterStarted(activeCycle as CycleWithQuarterDates, q);
                const qEnded = hasQuarterEnded(activeCycle as CycleWithQuarterDates, q);
                const qWorkStatus = canWorkOnQuarter(activeCycle as CycleWithQuarterDates, q, hasLatePermission);
                const startDate = getQuarterStartDateFromCycle(activeCycle as CycleWithQuarterDates, q);
                const endDate = getQuarterEndDateFromCycle(activeCycle as CycleWithQuarterDates, q);

                return (
                  <TabsContent key={q} value={`q${q}`} className="space-y-6">
                    {/* Show message if quarter hasn't started */}
                    {!qStarted ? (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
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
                    ) : qEnded && !hasLatePermission ? (<>
                          <div className='flex flex-row items-start justify-start gap-2 bg-red-300 p-2'>
                          <AlertTriangle className="h-12 w-12 text-amber-700 mr-2" />
                          <h3 className="font-normal text-lg my-auto text-black">{formatQuarterLabel(q)} Goal Setting Period Has Ended</h3>
                          </div>
                  
                        <div>
                          {kras.length > 0 && (
                            <div className="mt-6 w-full space-y-4">
                              {/* <p className="text-sm font-medium text-center">Your {formatQuarterLabel(q)} Goals (Read-only):</p> */}
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
                        </div>
             
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
                                  <Button onClick={kraOps.submitForApproval} className="w-full" disabled={!isValid}>
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
