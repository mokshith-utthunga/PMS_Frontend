// Custom hook for Bonus KRA/KPI operations
import { useCallback } from 'react';
import { goalsService } from '@/services';
import { toasts } from '@/toasts';
import type { BonusKRA, BonusKPI } from '@/types';

interface UseBonusOperationsProps {
  employeeId: string | null;
  cycleId: string | null;
  bonusKras: BonusKRA[];
  bonusKpis: BonusKPI[];
  onSuccess: () => void;
}

export function useBonusOperations({
  employeeId,
  cycleId,
  bonusKras,
  bonusKpis,
  onSuccess,
}: UseBonusOperationsProps) {
  const getBonusKPIsForKRA = useCallback(
    (bonusKraId: string) => bonusKpis.filter(kpi => kpi.bonus_kra_id === bonusKraId),
    [bonusKpis]
  );

  // Bonus KRA operations
  const createBonusKRA = useCallback(
    async (data: { title: string; description: string }) => {
      if (!employeeId || !cycleId) return;

      await goalsService.bonusKras.create({
        employee_id: employeeId,
        cycle_id: cycleId,
        title: data.title,
        description: data.description || null,
        status: 'draft',
      });

      toasts.success('Bonus KRA created successfully');
      onSuccess();
    },
    [employeeId, cycleId, onSuccess]
  );

  const updateBonusKRA = useCallback(
    async (id: string, data: { title: string; description: string }) => {
      await goalsService.bonusKras.update(id, {
        title: data.title,
        description: data.description || null,
      });

      toasts.success('Bonus KRA updated successfully');
      onSuccess();
    },
    [onSuccess]
  );

  const deleteBonusKRA = useCallback(
    async (id: string) => {
      await goalsService.bonusKras.delete(id);
      toasts.success('Bonus KRA deleted');
      onSuccess();
    },
    [onSuccess]
  );

  // Bonus KPI operations
  const createBonusKPI = useCallback(
    async (
      bonusKraId: string,
      data: { title: string; description: string; metric_type: string; target_value: string; due_date: string }
    ) => {
      await goalsService.bonusKpis.create({
        bonus_kra_id: bonusKraId,
        title: data.title,
        description: data.description || null,
        metric_type: data.metric_type,
        target_value: data.target_value || null,
        due_date: data.due_date || null,
        status: 'draft',
      });

      toasts.success('Bonus KPI created successfully');
      onSuccess();
    },
    [onSuccess]
  );

  const updateBonusKPI = useCallback(
    async (
      id: string,
      data: { title: string; description: string; metric_type: string; target_value: string; due_date: string }
    ) => {
      await goalsService.bonusKpis.update(id, {
        title: data.title,
        description: data.description || null,
        metric_type: data.metric_type,
        target_value: data.target_value || null,
        due_date: data.due_date || null,
      });

      toasts.success('Bonus KPI updated successfully');
      onSuccess();
    },
    [onSuccess]
  );

  const deleteBonusKPI = useCallback(
    async (id: string) => {
      await goalsService.bonusKpis.delete(id);
      toasts.success('Bonus KPI deleted');
      onSuccess();
    },
    [onSuccess]
  );

  // Submit bonus KRAs for approval
  const submitBonusForApproval = useCallback(async () => {
    const draftBonusKRAs = bonusKras.filter(b => b.status === 'draft' || b.status === 'returned');
    const allHaveKPIs = draftBonusKRAs.every(bkra => getBonusKPIsForKRA(bkra.id).length > 0);

    if (!allHaveKPIs) {
      toasts.error('KPIs Required', 'Each Bonus KRA must have at least 1 KPI before submission');
      return;
    }

    try {
      // Submit bonus KRAs
      for (const bkra of draftBonusKRAs) {
        await goalsService.bonusKras.update(bkra.id, { status: 'submitted' });
      }

      // Submit bonus KPIs
      const draftKPIIds = bonusKpis
        .filter(kpi => 
          draftBonusKRAs.some(bkra => bkra.id === kpi.bonus_kra_id) &&
          (kpi.status === 'draft' || kpi.status === 'returned')
        )
        .map(kpi => kpi.id);

      for (const kpiId of draftKPIIds) {
        await goalsService.bonusKpis.update(kpiId, { status: 'submitted' });
      }

      toasts.success('Bonus KRAs and KPIs submitted for approval');
      onSuccess();
    } catch (error) {
      toasts.error(error);
    }
  }, [bonusKras, bonusKpis, getBonusKPIsForKRA, onSuccess]);

  return {
    getBonusKPIsForKRA,
    createBonusKRA,
    updateBonusKRA,
    deleteBonusKRA,
    createBonusKPI,
    updateBonusKPI,
    deleteBonusKPI,
    submitBonusForApproval,
  };
}
