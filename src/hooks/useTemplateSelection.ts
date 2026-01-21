// Custom hook for template selection in Goals page
import { useCallback } from 'react';
import { goalsService } from '@/services';
import { toasts } from '@/toasts';
import { MAX_KRAS } from '@/utils/constants';

interface UseTemplateSelectionProps {
  employeeId: string | null;
  cycleId: string | null;
  krasCount: number;
  availableKRAWeight: number;
  onSuccess: () => void;
}

interface Template {
  title: string;
  description?: string | null;
  suggested_weight: number;
  kpi_templates?: Array<{
    title: string;
    description?: string | null;
    metric_type: string;
    suggested_target?: string | null;
    suggested_weight: number;
  }>;
}

export function useTemplateSelection({
  employeeId,
  cycleId,
  krasCount,
  availableKRAWeight,
  onSuccess,
}: UseTemplateSelectionProps) {
  const selectTemplate = useCallback(
    async (template: Template) => {
      if (!employeeId || !cycleId) return;

      if (krasCount >= MAX_KRAS) {
        toasts.error('Maximum KRAs Reached', `You can have at most ${MAX_KRAS} KRAs`);
        throw new Error('Maximum KRAs reached');
      }

      const weight = Math.min(template.suggested_weight, availableKRAWeight);
      if (weight <= 0) {
        toasts.error('No Weight Available', 'Adjust existing KRAs to make room');
        throw new Error('No weight available');
      }

      // Create KRA from template
      const kraResult = await goalsService.kras.create({
        employee_id: employeeId,
        cycle_id: cycleId,
        title: template.title,
        description: template.description || null,
        weight: weight,
        status: 'draft',
      });

      if (kraResult.error) {
        toasts.error(kraResult.error);
        throw new Error(kraResult.error);
      }

      // Create KPIs from template
      if (template.kpi_templates && template.kpi_templates.length > 0) {
        for (const kpi of template.kpi_templates) {
          await goalsService.kpis.create({
            employee_id: employeeId,
            cycle_id: cycleId,
            kra_id: kraResult.data.id,
            title: kpi.title,
            description: kpi.description || null,
            goal_type: 'kpi',
            metric_type: kpi.metric_type,
            target_value: kpi.suggested_target || null,
            weight: kpi.suggested_weight,
            status: 'draft',
          });
        }
      }

      toasts.success('KRA created from template with KPIs');
      onSuccess();
    },
    [employeeId, cycleId, krasCount, availableKRAWeight, onSuccess]
  );

  return { selectTemplate };
}
