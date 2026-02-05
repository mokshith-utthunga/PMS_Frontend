// Custom hook for KRA CRUD operations
import { useCallback } from 'react';
import { goalsService, employeeService, notifyGoalApproval } from '@/services';
import { toasts } from '@/toasts';
import { MIN_KRAS, MAX_KRAS, TOTAL_WEIGHT } from '@/utils/constants';
import type { KRA, Goal } from '@/types';

interface UseKraOperationsProps {
  employeeId: string | null;
  cycleId: string | null;
  kras: KRA[];
  kpis: Goal[];
  onSuccess: () => void;
  quarter?: number | null;
}

export function useKraOperations({
  employeeId,
  cycleId,
  kras,
  kpis,
  onSuccess,
  quarter,
}: UseKraOperationsProps) {
  const totalKRAWeight = kras.reduce((sum, kra) => sum + Number(kra.weight || 0), 0);
  const availableKRAWeight = TOTAL_WEIGHT - totalKRAWeight;

  const getKPIsForKRA = useCallback(
    (kraId: string) => kpis.filter(kpi => kpi.kra_id === kraId),
    [kpis]
  );

  const getAvailableKPIWeight = useCallback(
    (kraId: string) => {
      const kraKpis = getKPIsForKRA(kraId);
      return TOTAL_WEIGHT - kraKpis.reduce((sum, kpi) => sum + Number(kpi.weight || 0), 0);
    },
    [getKPIsForKRA]
  );

  const canEdit = useCallback(
    (status: string) => status === 'draft' || status === 'returned',
    []
  );

  const createKRA = useCallback(
    async (data: { title: string; description: string; weight: number; kra_template_id?: string | null }) => {
      if (!employeeId || !cycleId) return;

      if (kras.length >= MAX_KRAS) {
        toasts.error('Maximum KRAs Reached', `You can have at most ${MAX_KRAS} KRAs`);
        throw new Error('Maximum KRAs reached');
      }

      if (data.weight > availableKRAWeight) {
        toasts.error('Weight Limit Exceeded', `Available weight: ${availableKRAWeight}%`);
        throw new Error('Weight limit exceeded');
      }

      // Check for duplicate kra_template_id (only if kra_template_id is provided)
      // Rule: Employee cannot have the same kra_template_id in the same quarter and cycle_id
      // Exception: This rule does NOT apply if any KRA in that quarter has a transition_id
      if (data.kra_template_id) {
        // Check if any existing KRA in this quarter has a transition_id
        const hasTransition = kras.some(kra => {
          const sameQuarter = (kra.quarter === quarter) || (kra.quarter === null && quarter === null);
          return sameQuarter && kra.transition_id !== null && kra.transition_id !== undefined;
        });

        // Only check for duplicates if there's no transition
        if (!hasTransition) {
          const duplicateKRA = kras.find(kra => {
            const sameTemplate = kra.kra_template_id === data.kra_template_id;
            const sameEmployee = kra.employee_id === employeeId;
            const sameCycle = kra.cycle_id === cycleId;
            const sameQuarter = (kra.quarter === quarter) || (kra.quarter === null && quarter === null);
            
            return sameTemplate && sameEmployee && sameCycle && sameQuarter;
          });

          if (duplicateKRA) {
            toasts.error('Duplicate KRA Template', `A KRA with this template already exists in quarter ${quarter ? `Q${quarter}` : 'this quarter'} for this cycle.`);
            throw new Error('Duplicate kra_template_id');
          }
        }
      }

      const result = await goalsService.kras.create({
        employee_id: employeeId,
        cycle_id: cycleId,
        kra_template_id: data.kra_template_id || null,
        title: data.title,
        description: data.description || null,
        weight: data.weight,
        status: 'draft',
        quarter: quarter || null,
      });

      if (result.error) {
        toasts.error(result.error);
        throw new Error(result.error);
      }

      toasts.success('KRA created successfully');
      onSuccess();
    },
    [employeeId, cycleId, kras, availableKRAWeight, onSuccess, quarter]
  );

  const updateKRA = useCallback(
    async (kraId: string, currentWeight: number, data: { title: string; description: string; weight: number }) => {
      const maxWeight = availableKRAWeight + currentWeight;
      if (data.weight > maxWeight) {
        toasts.error('Weight Limit Exceeded', `Available weight: ${maxWeight}%`);
        throw new Error('Weight limit exceeded');
      }

      const result = await goalsService.kras.update(kraId, {
        title: data.title,
        description: data.description || null,
        weight: data.weight,
      });

      if (result.error) {
        toasts.error(result.error);
        throw new Error(result.error);
      }

      toasts.success('KRA updated successfully');
      onSuccess();
    },
    [availableKRAWeight, onSuccess]
  );

  const deleteKRA = useCallback(
    async (id: string) => {
      try {
        await goalsService.kras.delete(id);
        toasts.success('KRA deleted');
        onSuccess();
      } catch (error: any) {
        // If KRA doesn't exist (404), it might have been already deleted
        // Refresh data anyway to sync UI with server state
        if (error?.statusCode === 404 || error?.message?.toLowerCase().includes('not found')) {
          toasts.info('KRA not found', 'The KRA may have already been deleted. Refreshing...');
          onSuccess(); // Refresh to sync UI
        } else {
          toasts.error('Failed to delete KRA', error?.message || 'An error occurred');
          throw error;
        }
      }
    },
    [onSuccess]
  );

  const submitForApproval = useCallback(async () => {
    if (!employeeId) return;

    if (kras.length < MIN_KRAS) {
      toasts.error(
        'Minimum 3 KRAs Required',
        `You have ${kras.length} KRA(s). Add at least ${MIN_KRAS - kras.length} more.`
      );
      return;
    }

    if (totalKRAWeight !== TOTAL_WEIGHT) {
      toasts.error('KRA Weight Must Equal 100%', `Current total: ${totalKRAWeight}%`);
      return;
    }

    // Validate KPIs for each KRA
    for (const kra of kras) {
      const kraKpis = getKPIsForKRA(kra.id);
      if (kraKpis.length === 0) {
        toasts.error('KPIs Required', `"${kra.title}" needs at least one KPI`);
        return;
      }
      const kpiWeight = kraKpis.reduce((sum, kpi) => sum + Number(kpi.weight || 0), 0);
      if (kpiWeight !== TOTAL_WEIGHT) {
        toasts.error(
          'KPI Weight Must Equal 100%',
          `"${kra.title}" KPIs total ${kpiWeight}%, should be 100%`
        );
        return;
      }
    }

    try {
      // Submit draft/returned KRAs
      const draftKRAs = kras.filter(k => k.status === 'draft' || k.status === 'returned');
      for (const kra of draftKRAs) {
        await goalsService.kras.update(kra.id, { status: 'submitted' });
      }

      // Submit draft/returned KPIs
      const draftKPIs = kpis.filter(k => k.status === 'draft' || k.status === 'returned');
      for (const kpi of draftKPIs) {
        await goalsService.kpis.update(kpi.id, { status: 'submitted' });
      }

      // Notify manager
      const empResult = await employeeService.getById(employeeId);
      const emp = empResult.data;
      if (emp?.manager_id) {
        const mgrResult = await employeeService.getById(emp.manager_id);
        const mgr = mgrResult.data;
        if (mgr?.user_id) {
          await notifyGoalApproval(
            mgr.user_id,
            `${emp.first_name} ${emp.last_name}`,
            `/team/${employeeId}/goals`
          );
        }
      }

      toasts.success('KRAs and KPIs submitted for approval');
      onSuccess();
    } catch (error) {
      toasts.error(error);
    }
  }, [employeeId, kras, kpis, totalKRAWeight, getKPIsForKRA, onSuccess]);

  return {
    totalKRAWeight,
    availableKRAWeight,
    getKPIsForKRA,
    getAvailableKPIWeight,
    canEdit,
    createKRA,
    updateKRA,
    deleteKRA,
    submitForApproval,
  };
}
