// Custom hook for template selection in Goals page
import { useCallback } from 'react';
import { goalsService } from '@/services';
import { toasts } from '@/toasts';
import { MAX_KRAS } from '@/utils/constants';
import type { KRA } from '@/types';

interface UseTemplateSelectionProps {
  employeeId: string | null;
  cycleId: string | null;
  krasCount: number;
  kras: KRA[];
  availableKRAWeight: number;
  onSuccess: () => void;
  quarter?: number | null;
}

interface KPITemplate {
  id?: string;
  title: string;
  description?: string | null;
  metric_type: string;
  suggested_target?: string | null;
  suggested_weight: number;
  calibration?: Array<{ threshold: number; rating: number }> | null;
}

interface Template {
  id?: string; // KRA template ID for traceability
  title: string;
  description?: string | null;
  suggested_weight: number;
  kpi_templates?: KPITemplate[];
}

export function useTemplateSelection({
  employeeId,
  cycleId,
  krasCount,
  kras,
  availableKRAWeight,
  onSuccess,
  quarter,
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

      // Check for duplicate kra_template_id (only if kra_template_id is provided)
      // Rule: Employee cannot have the same kra_template_id in the same quarter and cycle_id
      // Exception: This rule does NOT apply if any KRA in that quarter has a transition_id
      if (template.id) {
        // Check if any existing KRA in this quarter has a transition_id
        const hasTransition = kras.some(kra => {
          const sameQuarter = (kra.quarter === quarter) || (kra.quarter === null && quarter === null);
          return sameQuarter && kra.transition_id !== null && kra.transition_id !== undefined;
        });

        // Only check for duplicates if there's no transition
        if (!hasTransition) {
          const duplicateKRA = kras.find(kra => {
            const sameTemplate = kra.kra_template_id === template.id;
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

      // Create KRA from template (include kra_template_id for traceability)
      const kraResult = await goalsService.kras.create({
        employee_id: employeeId,
        cycle_id: cycleId,
        kra_template_id: template.id || null, // Track which template was used
        title: template.title,
        description: template.description || null,
        weight: weight,
        status: 'draft',
        quarter: quarter || null,
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
            kpi_template_id: kpi.id || null, // Track which KPI template was used
            title: kpi.title,
            description: kpi.description || null,
            goal_type: 'kpi',
            metric_type: kpi.metric_type,
            target_value: kpi.suggested_target || null,
            weight: kpi.suggested_weight,
            calibration: kpi.calibration || null,
            status: 'draft',
            quarter: quarter || null,
          });
        }
      }

      toasts.success('KRA created from template with KPIs');
      onSuccess();
    },
    [employeeId, cycleId, krasCount, kras, availableKRAWeight, onSuccess, quarter]
  );

  return { selectTemplate };
}
