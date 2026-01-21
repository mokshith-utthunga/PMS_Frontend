// Custom hook for Goals page data fetching
import { useState, useEffect, useCallback } from 'react';
import { employeeService, cycleService, goalsService } from '@/services';
import { logError } from '@/errors';
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
  const [data, setData] = useState<GoalsData>({
    employeeId: null,
    employeeProfile: null,
    activeCycle: null,
    kras: [],
    kpis: [],
    bonusKras: [],
    bonusKpis: [],
    hasLatePermission: false,
    loading: true,
  });

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      // Get current employee
      const empResult = await employeeService.getMe();
      if (!empResult.data) {
        setData(prev => ({ ...prev, loading: false }));
        return;
      }

      const employeeId = empResult.data.id;
      const employeeProfile = {
        department: empResult.data.department,
        grade: empResult.data.grade,
      };

      // Get active cycle
      const cycleResult = await cycleService.getActive();
      if (!cycleResult.data) {
        setData(prev => ({
          ...prev,
          employeeId,
          employeeProfile,
          loading: false,
        }));
        return;
      }

      const cycleId = cycleResult.data.id;

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
        activeCycle: cycleResult.data,
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
  }, [userId, quarter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, refetch: fetchData };
}
