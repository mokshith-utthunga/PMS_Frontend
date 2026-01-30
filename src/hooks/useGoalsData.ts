// Custom hook for Goals page data fetching
import { useState, useEffect, useCallback } from 'react';
import { goalsService } from '@/services';
import { logError } from '@/errors';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { useCurrentEmployee } from './useCurrentEmployee';
import type { KRA, Goal, BonusKRA, BonusKPI, PerformanceCycle } from '@/types';

export interface GoalsData {
  employeeId: string | null;
  employeeProfile: { department: string; grade: string } | null;
  activeCycle: PerformanceCycle | null;
  kras: KRA[];
  kpis: Goal[];
  bonusKras: BonusKRA[];
  bonusKpis: BonusKPI[];
  hasLatePermission: boolean;
  loading: boolean;
}

export function useGoalsData(userId: string | undefined, quarter?: number | null) {
  // Get active cycle from context (fetched once at app initialization)
  const { activeCycle: activeCycleFromContext } = useActiveCycle();
  // Get current employee from cached hook (fetched once at app initialization)
  const { employee: currentEmployee } = useCurrentEmployee();
  
  const [data, setData] = useState<GoalsData>({
    employeeId: currentEmployee?.id || null,
    employeeProfile: currentEmployee ? {
      department: currentEmployee.department,
      grade: currentEmployee.grade,
    } : null,
    activeCycle: activeCycleFromContext,
    kras: [],
    kpis: [],
    bonusKras: [],
    bonusKpis: [],
    hasLatePermission: false,
    loading: true,
  });

  // Update activeCycle and employee when context data changes
  useEffect(() => {
    if (activeCycleFromContext) {
      setData(prev => ({ ...prev, activeCycle: activeCycleFromContext }));
    }
    if (currentEmployee) {
      setData(prev => ({
        ...prev,
        employeeId: currentEmployee.id,
        employeeProfile: {
          department: currentEmployee.department,
          grade: currentEmployee.grade,
        },
      }));
    }
  }, [activeCycleFromContext, currentEmployee]);

  const fetchData = useCallback(async () => {
    if (!userId || !currentEmployee) return;

    try {
      const employeeId = currentEmployee.id;
      const employeeProfile = {
        department: currentEmployee.department,
        grade: currentEmployee.grade,
      };

      // Use active cycle from context (already fetched at app initialization)
      const activeCycle = activeCycleFromContext;
      if (!activeCycle) {
        setData(prev => ({
          ...prev,
          employeeId,
          employeeProfile,
          loading: false,
        }));
        return;
      }

      const cycleId = activeCycle.id;

      // Fetch all data in parallel with quarter filter
      const [krasResult, kpisResult, bonusKrasResult, latePermResult] = await Promise.all([
        goalsService.kras.getByEmployee(employeeId, cycleId, undefined, quarter),
        goalsService.kpis.getByEmployee(employeeId, cycleId, undefined, quarter),
        goalsService.bonusKras.getByEmployee(employeeId, cycleId),
        goalsService.lateSubmission.check(cycleId, quarter || undefined).catch(() => ({ data: [], hasPermission: false })), // Handle 403 gracefully
      ]);

      const kras = krasResult.data || [];
      const kpis = (kpisResult.data || []).filter(g => g.kra_id) as Goal[];
      const bonusKras = bonusKrasResult.data || [];

      // Fetch bonus KPIs for all bonus KRAs
      let bonusKpis: BonusKPI[] = [];
      if (bonusKras.length > 0) {
        const bonusKpiPromises = bonusKras.map(bkra => 
          goalsService.bonusKpis.getByBonusKRA(bkra.id)
        );
        const bonusKpiResults = await Promise.all(bonusKpiPromises);
        bonusKpis = bonusKpiResults.flatMap(r => r.data || []);
      }

      setData({
        employeeId,
        employeeProfile,
        activeCycle: activeCycle,
        kras,
        kpis,
        bonusKras,
        bonusKpis,
        hasLatePermission: latePermResult.hasPermission ?? false,
        loading: false,
      });
    } catch (error) {
      logError(error, 'useGoalsData');
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [userId, quarter, activeCycleFromContext, currentEmployee]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, refetch: fetchData };
}
