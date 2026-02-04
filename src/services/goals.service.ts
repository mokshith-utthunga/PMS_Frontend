// Goals Service - KRA, KPI API calls
import { api } from './api';
import type { KRA, Goal, GoalStatus } from '@/types';
import type { PeriodType } from './transition.service';

// KRA Types for this service
export interface CreateKRAData {
  employee_id: string;
  cycle_id: string;
  kra_template_id?: string | null;
  title: string;
  description?: string | null;
  weight: number;
  status?: GoalStatus;
  quarter?: number | null;
}

export interface UpdateKRAData {
  title?: string;
  description?: string | null;
  weight?: number;
  status?: GoalStatus;
  manager_comments?: string | null;
  quarter?: number | null;
}

// KPI Types
export interface CreateKPIData {
  employee_id: string;
  cycle_id: string;
  kra_id: string;
  kpi_template_id?: string | null;
  title: string;
  description?: string | null;
  goal_type?: string;
  metric_type: string;
  target_value?: string | null;
  weight: number;
  calibration?: Array<{ threshold: number; rating: number }> | null;
  due_date?: string | null;
  status?: GoalStatus;
  quarter?: number | null;
}

export interface UpdateKPIData {
  title?: string;
  description?: string | null;
  metric_type?: string;
  target_value?: string | null;
  weight?: number;
  calibration?: Array<{ threshold: number; rating: number }> | null;
  due_date?: string | null;
  status?: GoalStatus;
  manager_comments?: string | null;
  quarter?: number | null;
}

export const goalsService = {
  // ========== KRA Operations ==========
  kras: {
    getAll: (cycleId: string, status?: string, quarter?: number | null, periodType?: PeriodType | null, transitionId?: string | null) => {
      let url = `/api/kras?cycle_id=${cycleId}`;
      if (status) url += `&status=${status}`;
      // Only add quarter param when it's a valid number (1-4)
      if (quarter && quarter >= 1 && quarter <= 4) {
        url += `&quarter=${quarter}`;
      }
      if (periodType) url += `&period_type=${periodType}`;
      if (transitionId) url += `&transition_id=${transitionId}`;
      return api.get<{ data: KRA[] }>(url);
    },

    getByEmployee: (employeeId: string, cycleId: string, status?: string, quarter?: number | null, periodType?: PeriodType | null, transitionId?: string | null) => {
      let url = `/api/kras?employee_id=${employeeId}&cycle_id=${cycleId}`;
      if (status) url += `&status=${status}`;
      // Only add quarter param when it's a valid number (1-4)
      if (quarter && quarter >= 1 && quarter <= 4) {
        url += `&quarter=${quarter}`;
      }
      if (periodType) url += `&period_type=${periodType}`;
      if (transitionId) url += `&transition_id=${transitionId}`;
      return api.get<{ data: KRA[] }>(url);
    },

    create: (data: CreateKRAData) => 
      api.post<{ data: KRA; error?: string }>('/api/kras', data),

    update: (id: string, data: UpdateKRAData) => 
      api.put<{ data: KRA; error?: string }>(`/api/kras/${id}`, data),

    delete: (id: string) => 
      api.delete(`/api/kras/${id}`),

    revoke: (id: string) => 
      api.post<{ message: string }>(`/api/kras/${id}/revoke`),

    // Approve KRA (by updating status to approved)
    approve: (id: string) => 
      api.put<{ data: KRA }>(`/api/kras/${id}`, { status: 'approved' }),
  },

  // ========== KPI/Goals Operations ==========
  kpis: {
    getByEmployee: (employeeId: string, cycleId: string, status?: string, quarter?: number | null, periodType?: PeriodType | null, transitionId?: string | null) => {
      let url = `/api/goals?employee_id=${employeeId}&cycle_id=${cycleId}`;
      if (status) url += `&status=${status}`;
      // Only add quarter param when it's a valid number (1-4)
      if (quarter && quarter >= 1 && quarter <= 4) {
        url += `&quarter=${quarter}`;
      }
      if (periodType) url += `&period_type=${periodType}`;
      if (transitionId) url += `&transition_id=${transitionId}`;
      return api.get<{ data: Goal[] }>(url);
    },

    getByKRA: (kraId: string) => 
      api.get<{ data: Goal[] }>(`/api/goals?kra_id=${kraId}`),

    create: (data: CreateKPIData) => 
      api.post<{ data: Goal; error?: string }>('/api/goals', {
        ...data,
        goal_type: data.goal_type || 'kpi',
      }),

    update: (id: string, data: UpdateKPIData) => 
      api.put<{ data: Goal; error?: string }>(`/api/goals/${id}`, data),

    delete: (id: string) => 
      api.delete(`/api/goals/${id}`),

    revoke: (id: string) => 
      api.post<{ message: string }>(`/api/goals/${id}/revoke`),

    // Pending approvals for managers
    getPendingApprovals: (cycleId: string) => 
      api.get<{ data: Goal[]; count: number }>(
        `/api/goals/pending-approvals?cycle_id=${cycleId}`
      ),

    // Approve goal
    approve: (id: string) => 
      api.post<{ data: Goal }>(`/api/goals/${id}/approve`),
  },

  // ========== Late Submission Permission ==========
  lateSubmission: {
    check: (cycleId: string, quarter?: number) => {
      let url = `/api/permissions/late-submission/check?cycle_id=${cycleId}`;
      if (quarter) {
        url += `&quarter=${quarter}`;
      }
      return api.get<{ data: unknown[]; hasPermission: boolean }>(url);
    },
  },

  // ========== Clone Goals ==========
  clone: {
    cloneGoals: (employeeId: string, cycleId: string, sourceQuarter: number, targetQuarter: number) =>
      api.post<{ data: { kras: KRA[]; kpis: Goal[] }; message: string }>(
        '/api/goals/clone',
        {
          employee_id: employeeId,
          cycle_id: cycleId,
          source_quarter: sourceQuarter,
          target_quarter: targetQuarter,
        }
      ),
  },
};
