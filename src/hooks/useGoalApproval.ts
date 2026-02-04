// Custom hook for goal approval operations
import { useState, useCallback } from 'react';
import { goalsService, notifyGoalApproved, notifyGoalReturned } from '@/services';
import { toasts } from '@/toasts';
import type { KRA, Goal, Employee } from '@/types';

interface UseGoalApprovalProps {
  employee: Employee | null;
  kras: KRA[];
  kpis: Goal[];
  onSuccess: () => void;
}

export function useGoalApproval({
  employee,
  kras,
  kpis,
  onSuccess,
}: UseGoalApprovalProps) {
  const [processing, setProcessing] = useState(false);

  const getKPIsForKRA = useCallback(
    (kraId: string) => kpis.filter(kpi => kpi.kra_id === kraId),
    [kpis]
  );

  const approveKRA = useCallback(
    async (kraId: string) => {
      setProcessing(true);
      try {
        const kra = kras.find(k => k.id === kraId);
        
        // Approve KRA
        await goalsService.kras.update(kraId, { status: 'approved', manager_comments: null });

        // Approve associated KPIs
        const kraKpis = getKPIsForKRA(kraId).filter(k => k.status === 'submitted');
        for (const kpi of kraKpis) {
          await goalsService.kpis.update(kpi.id, { status: 'approved', manager_comments: null });
        }

        // Notify employee
        if (employee?.user_id && kra) {
          await notifyGoalApproved(employee.user_id, kra.title);
        }

        toasts.success('KRA and KPIs approved');
        onSuccess();
      } catch (error) {
        toasts.error(error);
      } finally {
        setProcessing(false);
      }
    },
    [kras, getKPIsForKRA, employee, onSuccess]
  );

  const approveAll = useCallback(
    async () => {
      const submittedKRAs = kras.filter(k => k.status === 'submitted');
      const submittedKPIs = kpis.filter(k => k.status === 'submitted');

      const hasSubmittedItems = 
        submittedKRAs.length > 0 || submittedKPIs.length > 0;

      if (!hasSubmittedItems) return;

      setProcessing(true);
      try {
        // Approve all KRAs
        for (const kra of submittedKRAs) {
          await goalsService.kras.update(kra.id, { status: 'approved', manager_comments: null });
        }

        // Approve all KPIs
        for (const kpi of submittedKPIs) {
          await goalsService.kpis.update(kpi.id, { status: 'approved', manager_comments: null });
        }

        // Notify employee
        if (employee?.user_id) {
          await notifyGoalApproved(
            employee.user_id,
            `All goals (${submittedKRAs.length} KRAs)`
          );
        }

        toasts.success('All KRAs and KPIs approved');
        onSuccess();
      } catch (error) {
        toasts.error(error);
      } finally {
        setProcessing(false);
      }
    },
    [kras, kpis, employee, onSuccess]
  );

  const returnItem = useCallback(
    async (
      type: 'kra' | 'kpi',
      id: string,
      comments: string
    ) => {
      if (!comments.trim()) {
        toasts.error('Comments required', 'Please provide feedback for returning');
        return false;
      }

      setProcessing(true);
      try {
        let itemTitle = '';

        switch (type) {
          case 'kra': {
            const kra = kras.find(k => k.id === id);
            itemTitle = kra?.title || 'KRA';
            await goalsService.kras.update(id, { status: 'returned', manager_comments: comments });
            // Return associated KPIs
            const kraKpis = getKPIsForKRA(id);
            for (const kpi of kraKpis) {
              await goalsService.kpis.update(kpi.id, { status: 'returned' });
            }
            toasts.success('KRA returned with feedback');
            break;
          }
          case 'kpi': {
            const kpi = kpis.find(k => k.id === id);
            itemTitle = kpi?.title || 'KPI';
            await goalsService.kpis.update(id, { status: 'returned', manager_comments: comments });
            toasts.success('KPI returned with feedback');
            break;
          }
        }

        // Notify employee
        if (employee?.user_id) {
          const typeLabel = type.toUpperCase();
          await notifyGoalReturned(employee.user_id, typeLabel, itemTitle, comments);
        }

        onSuccess();
        return true;
      } catch (error) {
        toasts.error(error);
        return false;
      } finally {
        setProcessing(false);
      }
    },
    [kras, kpis, employee, getKPIsForKRA, onSuccess]
  );

  return {
    processing,
    getKPIsForKRA,
    approveKRA,
    approveAll,
    returnItem,
  };
}
