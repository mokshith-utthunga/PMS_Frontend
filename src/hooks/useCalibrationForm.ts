// Custom hook for Calibration Form data and operations
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsService, calibrationService, evaluationService, employeeService } from '@/services';
import { toasts } from '@/toasts';
import { logError } from '@/errors';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { useCurrentEmployee } from './useCurrentEmployee';
import type { PerformanceCycle, RatingScale } from '@/types';

export interface QuotaRule {
  rating_value: number;
  percentage: number;
}

export interface CalibrationFormData {
  activeCycle: PerformanceCycle | null;
  departments: string[];
  grades: string[];
  businessUnits: string[];
  ratingScales: RatingScale[];
  defaultQuotas: Record<number, number>;
  departmentQuotas: Record<string, Record<number, number>>;
  loading: boolean;
}

export function useCalibrationFormData() {
  // Get active cycle from context (fetched once at app initialization)
  const { activeCycle: activeCycleFromContext } = useActiveCycle();
  
  const [data, setData] = useState<CalibrationFormData>({
    activeCycle: activeCycleFromContext,
    departments: [],
    grades: [],
    businessUnits: [],
    ratingScales: [],
    defaultQuotas: {},
    departmentQuotas: {},
    loading: true,
  });

  // Update activeCycle when context data changes
  useEffect(() => {
    if (activeCycleFromContext) {
      setData(prev => ({ ...prev, activeCycle: activeCycleFromContext }));
    }
  }, [activeCycleFromContext]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use active cycle from context (already fetched at app initialization)
        const activeCycle = activeCycleFromContext;
        if (!activeCycle) {
          setData(prev => ({ ...prev, loading: false }));
          return;
        }

        const [deptResult, gradeResult, buResult, scalesResult, defaultQuotasResult, deptQuotasResult] = 
          await Promise.all([
            settingsService.departments.getAll(),
            settingsService.grades.getAll(),
            settingsService.businessUnits.getAll(),
            settingsService.ratingScales.getDefault(),
            settingsService.calibrationQuotas.getDefaults(),
            settingsService.calibrationQuotas.getByDepartment(),
          ]);

        const defaultQuotasMap: Record<number, number> = {};
        (defaultQuotasResult.data || []).forEach(q => {
          defaultQuotasMap[q.rating_value] = Number(q.percentage);
        });

        const deptQuotasMap: Record<string, Record<number, number>> = {};
        (deptQuotasResult.data || []).forEach(q => {
          if (!deptQuotasMap[q.department]) {
            deptQuotasMap[q.department] = {};
          }
          deptQuotasMap[q.department][q.rating_value] = Number(q.percentage);
        });

        setData({
          activeCycle: activeCycle,
          departments: deptResult.data?.map(d => d.name) || [],
          grades: gradeResult.data?.map(g => g.name) || [],
          businessUnits: buResult.data?.map(b => b.name) || [],
          ratingScales: scalesResult.data || [],
          defaultQuotas: defaultQuotasMap,
          departmentQuotas: deptQuotasMap,
          loading: false,
        });
      } catch (error) {
        logError(error, 'useCalibrationFormData');
        setData(prev => ({ ...prev, loading: false }));
      }
    };

    fetchData();
  }, [activeCycleFromContext]);

  return data;
}

export function useCalibrationFormOperations(
  activeCycle: PerformanceCycle | null,
  ratingScales: RatingScale[],
  defaultQuotas: Record<number, number>,
  departmentQuotas: Record<string, Record<number, number>>
) {
  const navigate = useNavigate();
  // Get current employee from cached hook (fetched once at app initialization)
  const { employee: currentEmployee } = useCurrentEmployee();
  const [saving, setSaving] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [quotaRules, setQuotaRules] = useState<QuotaRule[]>([]);

  // Initialize quota rules
  useEffect(() => {
    if (ratingScales.length === 0) return;
    const initialQuotas = ratingScales.map(scale => ({
      rating_value: scale.value,
      percentage: defaultQuotas[scale.value] ?? (scale.value === 3 ? 70 : scale.value >= 4 ? 10 : 5),
    }));
    setQuotaRules(initialQuotas);
  }, [ratingScales, defaultQuotas]);

  // Update quotas when department changes
  const updateQuotasForDepartment = useCallback(
    (department: string) => {
      if (ratingScales.length === 0) return;
      if (department && departmentQuotas[department]) {
        const deptQuotas = departmentQuotas[department];
        setQuotaRules(ratingScales.map(scale => ({
          rating_value: scale.value,
          percentage: deptQuotas[scale.value] ?? defaultQuotas[scale.value] ?? 0,
        })));
      } else {
        setQuotaRules(ratingScales.map(scale => ({
          rating_value: scale.value,
          percentage: defaultQuotas[scale.value] ?? 0,
        })));
      }
    },
    [ratingScales, departmentQuotas, defaultQuotas]
  );

  // Fetch preview count
  const fetchPreviewCount = useCallback(
    async (filters: { department?: string; grade?: string; businessUnit?: string }) => {
      if (!activeCycle) return;
      try {
        const result = await evaluationService.managerReviews.getCompletedCount(activeCycle.id);
        setPreviewCount(result.count || 0);
      } catch (error) {
        logError(error, 'fetchPreviewCount');
      }
    },
    [activeCycle]
  );

  const handleQuotaChange = useCallback((ratingValue: number, percentage: number) => {
    setQuotaRules(prev =>
      prev.map(rule =>
        rule.rating_value === ratingValue ? { ...rule, percentage } : rule
      )
    );
  }, []);

  const totalPercentage = quotaRules.reduce((sum, r) => sum + Number(r.percentage || 0), 0);

  const submitForm = useCallback(
    async (formData: {
      name: string;
      description: string;
      department: string;
      grade: string;
      businessUnit: string;
    }) => {
      if (!formData.name.trim()) {
        toasts.error('Name required', 'Please enter a name for the calibration group');
        return;
      }

      if (!activeCycle) {
        toasts.error('No active cycle', 'An active performance cycle is required');
        return;
      }

      if (totalPercentage !== 100) {
        toasts.error('Invalid quotas', 'Quota percentages must total 100%');
        return;
      }

      setSaving(true);
      try {
        if (!currentEmployee) {
          toasts.error('Error', 'Employee data not available');
          setSaving(false);
          return;
        }

        const filters: Record<string, string> = {};
        if (formData.department) filters.department = formData.department;
        if (formData.grade) filters.grade = formData.grade;
        if (formData.businessUnit) filters.business_unit = formData.businessUnit;

        const groupResult = await calibrationService.groups.create({
          name: formData.name,
          description: formData.description || null,
          cycle_id: activeCycle.id,
          filters,
          status: 'draft',
          created_by: currentEmployee.id,
        });

        // Create quota rules
        for (const rule of quotaRules) {
          await calibrationService.quotaRules.create(groupResult.data.id, {
            rating_value: rule.rating_value,
            percentage: rule.percentage,
          });
        }

        // Fetch employees and create entries
        const employeesResult = await employeeService.getList({
          status: 'active',
          department: formData.department || undefined,
          grade: formData.grade || undefined,
          business_unit: formData.businessUnit || undefined,
        });

        for (const emp of employeesResult.data || []) {
          // Get latest quarterly manager review for this employee
          const mgrReviewsResult = await evaluationService.managerReviews.get(emp.id, activeCycle.id);
          const latestReview = (mgrReviewsResult.data || [])
            .filter((r: any) => r.status === 'submitted' || r.status === 'approved')
            .sort((a: any, b: any) => (b.quarter || 0) - (a.quarter || 0))[0];
          
          if (latestReview) {
            await calibrationService.entries.create(groupResult.data.id, {
              employee_id: emp.id,
              original_rating: latestReview.calculated_overall_rating || 0,
              calibrated_rating: latestReview.calculated_overall_rating || 0,
            });
          }
        }

        toasts.success('Calibration group created');
        navigate('/calibration');
      } catch (error) {
        toasts.error(error);
      } finally {
        setSaving(false);
      }
    },
    [activeCycle, quotaRules, totalPercentage, navigate]
  );

  return {
    saving,
    previewCount,
    quotaRules,
    totalPercentage,
    updateQuotasForDepartment,
    fetchPreviewCount,
    handleQuotaChange,
    submitForm,
  };
}
