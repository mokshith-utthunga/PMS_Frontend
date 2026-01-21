// Custom hook for Team Member Goals data fetching
import { useState, useEffect, useCallback } from 'react';
import { employeeService, cycleService, goalsService } from '@/services';
import { logError } from '@/errors';
import type { Employee, KRA, Goal, BonusKRA, BonusKPI } from '@/types';

export interface TeamMemberGoalsData {
  employee: Employee | null;
  kras: KRA[];
  kpis: Goal[];
  bonusKras: BonusKRA[];
  bonusKpis: BonusKPI[];
  loading: boolean;
}

export function useTeamMemberGoals(employeeId: string | undefined, quarter?: number | null) {
  const [data, setData] = useState<TeamMemberGoalsData>({
    employee: null,
    kras: [],
    kpis: [],
    bonusKras: [],
    bonusKpis: [],
    loading: true,
  });

  const fetchData = useCallback(async () => {
    if (!employeeId) return;

    try {
      // Fetch employee
      const empResult = await employeeService.getById(employeeId);
      if (!empResult.data) {
        setData(prev => ({ ...prev, loading: false }));
        return;
      }

      // Fetch active cycle
      const cycleResult = await cycleService.getActive();
      if (!cycleResult.data) {
        setData(prev => ({ ...prev, employee: empResult.data, loading: false }));
        return;
      }

      const cycleId = cycleResult.data.id;

      // Fetch all data in parallel with quarter filter
      const [krasResult, kpisResult] = await Promise.all([
        goalsService.kras.getByEmployee(employeeId, cycleId, undefined, quarter),
        goalsService.kpis.getByEmployee(employeeId, cycleId, undefined, quarter),
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
  }, [employeeId, quarter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, refetch: fetchData };
}
