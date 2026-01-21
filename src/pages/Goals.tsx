// Goals Page - Refactored with hooks and services
import { useState, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Send } from 'lucide-react';
import { PageLoader } from '@/loaders';
import { useGoalsData, useKraOperations, useKpiOperations, useBonusOperations, useTemplateSelection } from '@/hooks';
import { getGoalDeadlineStatus } from '@/utils/deadlineUtils';
import { getValidationIssues, hasDraftItems, isValidForSubmission } from '@/utils/goalsValidation';
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
import type { KRA, Goal, BonusKRA, BonusKPI } from '@/types';

export default function Goals() {
  const { user, hasAnyRole } = useAuth();
  const isHR = hasAnyRole(['hr_admin', 'hrbp', 'system_admin','dept_head','manager']);

  // Fetch all goals data
  const goalsData = useGoalsData(user?.id);
  const { employeeId, employeeProfile, activeCycle, kras, kpis, bonusKras, bonusKpis, hasLatePermission, loading, refetch } = goalsData;

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

  // KRA Operations
  const kraOps = useKraOperations({
    employeeId,
    cycleId: activeCycle?.id || null,
    kras,
    kpis,
    onSuccess: refetch,
  });

  // KPI Operations
  const kpiOps = useKpiOperations({
    employeeId,
    cycleId: activeCycle?.id || null,
    kpis,
    onSuccess: refetch,
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
  const showAddButton = activeCycle && employeeId && kras.length < 5 && canSubmit;
  const hasDraft = hasDraftItems(kras, kpis);
  const isValid = isValidForSubmission(kras, kpis, kraOps.getKPIsForKRA);
  const selectedKRA = selectedKRAId ? kras.find(k => k.id === selectedKRAId) : null;

  // Loading state
  if (loading) {
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
          {showAddButton && (
            <Button onClick={() => setTemplateSelectorOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add KRA
            </Button>
          )}
        </div>

        {/* Status Alerts */}
        <GoalStatusAlerts
          cycle={activeCycle}
          employeeId={employeeId}
          isHR={isHR}
          kras={kras}
          deadlineStatus={deadlineStatus}
          hasLatePermission={hasLatePermission}
        />

        {/* Main Content */}
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

            {/* Bonus KRAs Section */}
            {/* <BonusKRASection
              bonusKras={bonusKras}
              bonusKpis={bonusKpis}
              canAddBonus={canSubmit}
              canEdit={kraOps.canEdit}
              getBonusKPIsForKRA={bonusOps.getBonusKPIsForKRA}
              onAddBonusKRA={() => setBonusKraFormOpen(true)}
              onEditBonusKRA={b => { setEditingBonusKRA(b); setBonusKraFormOpen(true); }}
              onDeleteBonusKRA={bonusOps.deleteBonusKRA}
              onAddBonusKPI={bonusKraId => { setSelectedBonusKRAId(bonusKraId); setBonusKpiFormOpen(true); }}
              onEditBonusKPI={kpi => { setEditingBonusKPI(kpi); setSelectedBonusKRAId(kpi.bonus_kra_id); setBonusKpiFormOpen(true); }}
              onDeleteBonusKPI={bonusOps.deleteBonusKPI}
              onSubmitBonusKRAs={bonusOps.submitBonusForApproval}
            /> */}
          </>
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
