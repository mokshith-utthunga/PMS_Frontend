// Goals validation utilities
import { MIN_KRAS, MAX_KRAS, TOTAL_WEIGHT } from './constants';
import type { KRA, Goal } from '@/types';

export interface ValidationIssue {
  message: string;
  type: 'kra_count' | 'kra_weight' | 'kpi_missing' | 'kpi_weight';
}

export function getValidationIssues(
  kras: KRA[],
  kpis: Goal[],
  getKPIsForKRA: (kraId: string) => Goal[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const totalKRAWeight = kras.reduce((sum, kra) => sum + Number(kra.weight || 0), 0);

  // KRA count validation
  if (kras.length < MIN_KRAS) {
    issues.push({
      message: `Add ${MIN_KRAS - kras.length} more KRA(s) (minimum ${MIN_KRAS} required)`,
      type: 'kra_count',
    });
  } else if (kras.length > MAX_KRAS) {
    issues.push({
      message: `Remove ${kras.length - MAX_KRAS} KRA(s) (maximum ${MAX_KRAS} allowed)`,
      type: 'kra_count',
    });
  }

  // KRA weight validation
  if (totalKRAWeight !== TOTAL_WEIGHT) {
    if (totalKRAWeight < TOTAL_WEIGHT) {
      issues.push({
        message: `KRA weights total ${totalKRAWeight}% (need ${TOTAL_WEIGHT - totalKRAWeight}% more)`,
        type: 'kra_weight',
      });
    } else {
      issues.push({
        message: `KRA weights total ${totalKRAWeight}% (reduce by ${totalKRAWeight - TOTAL_WEIGHT}%)`,
        type: 'kra_weight',
      });
    }
  }

  // KPI validation for each KRA
  for (const kra of kras) {
    const kraKpis = getKPIsForKRA(kra.id);
    
    if (kraKpis.length === 0) {
      issues.push({
        message: `"${kra.title}" needs at least one KPI`,
        type: 'kpi_missing',
      });
    } else {
      const kpiWeight = kraKpis.reduce((sum, kpi) => sum + Number(kpi.weight || 0), 0);
      if (kpiWeight !== TOTAL_WEIGHT) {
        if (kpiWeight < TOTAL_WEIGHT) {
          issues.push({
            message: `"${kra.title}" KPIs total ${kpiWeight}% (need ${TOTAL_WEIGHT - kpiWeight}% more)`,
            type: 'kpi_weight',
          });
        } else {
          issues.push({
            message: `"${kra.title}" KPIs total ${kpiWeight}% (reduce by ${kpiWeight - TOTAL_WEIGHT}%)`,
            type: 'kpi_weight',
          });
        }
      }
    }
  }

  return issues;
}

export function isValidForSubmission(
  kras: KRA[],
  kpis: Goal[],
  getKPIsForKRA: (kraId: string) => Goal[]
): boolean {
  return getValidationIssues(kras, kpis, getKPIsForKRA).length === 0;
}

export function hasDraftItems(kras: KRA[], kpis: Goal[]): boolean {
  return (
    kras.some(k => k.status === 'draft' || k.status === 'returned') ||
    kpis.some(k => k.status === 'draft' || k.status === 'returned')
  );
}
