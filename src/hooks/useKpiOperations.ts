// Custom hook for KPI CRUD operations
import { useCallback } from 'react';
import { goalsService } from '@/services';
import { toasts } from '@/toasts';
import { TOTAL_WEIGHT } from '@/utils/constants';
import type { Goal } from '@/types';
import type { CalibrationRule } from '@/components/admin/CalibrationConfig';

interface CreateKPIData {
  title: string;
  description: string;
  metric_type: string;
  target_value: string;
  weight: number;
  calibration?: CalibrationRule[] | null;
}

interface UseKpiOperationsProps {
  employeeId: string | null;
  cycleId: string | null;
  kpis: Goal[];
  onSuccess: () => void;
  quarter?: number | null;
}

export function useKpiOperations({
  employeeId,
  cycleId,
  kpis,
  onSuccess,
  quarter,
}: UseKpiOperationsProps) {
  const getAvailableKPIWeight = useCallback(
    (kraId: string) => {
      const kraKpis = kpis.filter(kpi => kpi.kra_id === kraId);
      return TOTAL_WEIGHT - kraKpis.reduce((sum, kpi) => sum + Number(kpi.weight || 0), 0);
    },
    [kpis]
  );

  const createKPI = useCallback(
    async (kraId: string, data: CreateKPIData) => {
      if (!employeeId || !cycleId) return;

      const availableWeight = getAvailableKPIWeight(kraId);
      if (data.weight > availableWeight) {
        toasts.error('Weight Limit Exceeded', `Available weight: ${availableWeight}%`);
        throw new Error('Weight limit exceeded');
      }

      await goalsService.kpis.create({
        employee_id: employeeId,
        cycle_id: cycleId,
        kra_id: kraId,
        title: data.title,
        description: data.description || null,
        goal_type: 'kpi',
        metric_type: data.metric_type,
        target_value: data.target_value || null,
        weight: data.weight,
        calibration: data.calibration || null,
        status: 'draft',
        quarter: quarter || null,
      });

      toasts.success('KPI created successfully');
      onSuccess();
    },
    [employeeId, cycleId, getAvailableKPIWeight, onSuccess, quarter]
  );

  const updateKPI = useCallback(
    async (kpiId: string, kraId: string, currentWeight: number, data: CreateKPIData) => {
      const availableWeight = getAvailableKPIWeight(kraId) + currentWeight;
      if (data.weight > availableWeight) {
        toasts.error('Weight Limit Exceeded', `Available weight: ${availableWeight}%`);
        throw new Error('Weight limit exceeded');
      }

      await goalsService.kpis.update(kpiId, {
        title: data.title,
        description: data.description || null,
        metric_type: data.metric_type,
        target_value: data.target_value || null,
        weight: data.weight,
        calibration: data.calibration || null,
      });

      toasts.success('KPI updated successfully');
      onSuccess();
    },
    [getAvailableKPIWeight, onSuccess]
  );

  const deleteKPI = useCallback(
    async (id: string) => {
      await goalsService.kpis.delete(id);
      toasts.success('KPI deleted');
      onSuccess();
    },
    [onSuccess]
  );

  return {
    getAvailableKPIWeight,
    createKPI,
    updateKPI,
    deleteKPI,
  };
}
