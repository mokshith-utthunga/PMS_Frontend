// Custom hook for Goals page data fetching
import { useState, useEffect, useCallback } from 'react';
import { goalsService, transitionService } from '@/services';
import { logError } from '@/errors';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { useCurrentEmployee } from './useCurrentEmployee';
import type { KRA, Goal, PerformanceCycle } from '@/types';

export interface GoalsData {
  employeeId: string | null;
  employeeProfile: { department: string; grade: string } | null;
  activeCycle: PerformanceCycle | null;
  kras: KRA[];
  kpis: Goal[];
  hasLatePermission: boolean;
  hasActiveTransition: boolean;
  transition: any | null;
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
    hasLatePermission: false,
    hasActiveTransition: false,
    transition: null,
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

      // Check for active transition for this employee/cycle/quarter
      let transition = null;
      let hasActiveTransition = false;
      try {
        const transitions = await transitionService.getByEmployee(employeeId, cycleId, quarter || null);
        if (transitions.length > 0) {
          transition = transitions[0];
          hasActiveTransition = true;
          // Check if we're past the transition date (post-transition period)
          const transitionDate = new Date(transition.transition_date);
          const now = new Date();
          transitionDate.setHours(0, 0, 0, 0);
          now.setHours(0, 0, 0, 0);
          const isPostTransition = now >= transitionDate;
          console.log('Active transition found:', {
            transitionDate: transition.transition_date,
            currentDate: now.toISOString().split('T')[0],
            isPostTransition,
            quarter: transition.quarter
          });
        }
      } catch (error) {
        // Transition check failed, continue without transition
        console.warn('Failed to check transitions:', error);
      }

      // Fetch all data in parallel with quarter filter
      // Don't filter by period_type - fetch all goals (pre-transition, post-transition, and full_quarter)
      const [krasResult, kpisResult, latePermResult] = await Promise.all([
        goalsService.kras.getByEmployee(employeeId, cycleId, undefined, quarter),
        goalsService.kpis.getByEmployee(employeeId, cycleId, undefined, quarter),
        goalsService.lateSubmission.check(cycleId, quarter || undefined).catch(() => ({ data: [], hasPermission: false })), // Handle 403 gracefully
      ]);

      const kras = krasResult.data || [];
      const kpis = (kpisResult.data || []).filter(g => g.kra_id) as Goal[];

      setData({
        employeeId,
        employeeProfile,
        activeCycle: activeCycle,
        kras,
        kpis,
        hasLatePermission: latePermResult.hasPermission ?? false,
        hasActiveTransition,
        transition,
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
