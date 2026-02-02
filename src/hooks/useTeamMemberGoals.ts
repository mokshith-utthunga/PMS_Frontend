// Custom hook for Team Member Goals data fetching
import { useState, useEffect, useCallback, useMemo } from 'react';
import { employeeService, goalsService } from '@/services';
import { logError } from '@/errors';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { useTransition } from './useTransition';
import type { Employee, KRA, Goal, BonusKRA, BonusKPI } from '@/types';
import type { PeriodType } from '@/services/transition.service';

export interface TeamMemberGoalsData {
  employee: Employee | null;
  kras: KRA[];
  kpis: Goal[];
  bonusKras: BonusKRA[];
  bonusKpis: BonusKPI[];
  loading: boolean;
}

export function useTeamMemberGoals(employeeId: string | undefined, quarter?: number | null, periodType?: PeriodType | null) {
  // Get active cycle from context (fetched once at app initialization)
  const { activeCycle: activeCycleFromContext } = useActiveCycle();
  
  // Fetch transition if quarter is specified
  const { transition } = useTransition({
    employeeId,
    cycleId: activeCycleFromContext?.id,
    quarter,
    enabled: !!employeeId && !!activeCycleFromContext && !!quarter,
  });

  const [data, setData] = useState<TeamMemberGoalsData>({
    employee: null,
    kras: [],
    kpis: [],
    bonusKras: [],
    bonusKpis: [],
    loading: true,
  });

  // Memoize transition_id to avoid unnecessary re-fetches
  const transitionId = useMemo(() => transition?.id || null, [transition]);

  const fetchData = useCallback(async () => {
    if (!employeeId) return;

    try {
      // Fetch employee
      const empResult = await employeeService.getById(employeeId);
      if (!empResult.data) {
        setData(prev => ({ ...prev, loading: false }));
        return;
      }

      // Use active cycle from context (already fetched at app initialization)
      const activeCycle = activeCycleFromContext;
      if (!activeCycle) {
        setData(prev => ({ ...prev, employee: empResult.data, loading: false }));
        return;
      }

      const cycleId = activeCycle.id;

      // Fetch all data in parallel with quarter and period filters
      const [krasResult, kpisResult] = await Promise.all([
        goalsService.kras.getByEmployee(employeeId, cycleId, undefined, quarter, periodType || null, transitionId),
        goalsService.kpis.getByEmployee(employeeId, cycleId, undefined, quarter, periodType || null, transitionId),
      ]);

      // Fetch bonus KRAs via different endpoint used in manager view
      let bonusKras: BonusKRA[] = [];
      let bonusKpis: BonusKPI[] = [];
      
      try {
        const bonusKrasResult = await goalsService.bonusKras.getByEmployee(employeeId, cycleId);
        bonusKras = bonusKrasResult.data || [];
        
        if (bonusKras.length > 0) {
          const bonusKpiPromises = bonusKras.map(bkra => 
            goalsService.bonusKpis.getByBonusKRA(bkra.id)
          );
          const bonusKpiResults = await Promise.all(bonusKpiPromises);
          bonusKpis = bonusKpiResults.flatMap(r => r.data || []);
        }
      } catch {
        // Bonus KRAs might not be available
      }

      setData({
        employee: empResult.data,
        kras: krasResult.data || [],
        kpis: (kpisResult.data || []).filter(g => g.kra_id) as Goal[],
        bonusKras,
        bonusKpis,
        loading: false,
      });
    } catch (error) {
      logError(error, 'useTeamMemberGoals');
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [employeeId, quarter, periodType, transitionId, activeCycleFromContext]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(() => ({ ...data, refetch: fetchData, transition }), [data, fetchData, transition]);
}
