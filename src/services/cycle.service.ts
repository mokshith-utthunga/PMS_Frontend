// Cycle Service - All performance cycle API calls
import { api } from './api';
import type { PerformanceCycle } from '@/types';

export interface QuarterlyCycle {
  id: string;
  performance_cycle_id: string;
  quarter: number;
  quarter_start_date: string;
  quarter_end_date: string;
  self_review_start_date?: string | null;
  self_review_end_date?: string | null;
  quarterly_manager_review_start_date: string;
  quarterly_manager_review_end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface GoalsQuarterlyCycle {
  id: string;
  performance_cycle_id: string;
  quarterly_cycle_id?: string; // FK to quarterly_cycles
  quarter: number;
  // quarterly_start_date and quarterly_end_date are joined from quarterly_cycles (not stored in this table)
  quarterly_start_date?: string; // From quarterly_cycles.quarter_start_date via join
  quarterly_end_date?: string; // From quarterly_cycles.quarter_end_date via join
  goal_submission_start_date: string;
  goal_submission_end_date: string;
  goals_manager_review_start_date: string;
  goals_manager_review_end_date: string;
  allow_late_goal_submission: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ActiveCycleResponse {
  data: PerformanceCycle | null;
  quarterly_cycles?: QuarterlyCycle[];
  goals_quarterly_cycles?: GoalsQuarterlyCycle[];
  dashboard?: {
    direct_reports_count: number;
    goals_pending_approval: number;
    evaluations_pending: number;
    quarterly_pending: number;
    year_end_pending: number;
    quarterly_open_pending: number;
  } | null;
  goal_setting?: {
    quarter: number | null;
    present_quarter: number | null;
    enabled: boolean;
  };
  self_review?: {
    review_for_quarter: number | null;
    present_quarter: number | null;
    enabled: boolean;
  };
  manager_review?: {
    review_for_quarter: number | null;
    present_quarter: number | null;
    enabled: boolean;
  };
}

export const cycleService = {
  // Get active cycle (includes quarterly cycles and goals quarterly cycles)
  getActive: () => 
    api.get<ActiveCycleResponse>('/api/cycles/active'),

  // Get cycle by ID
  getById: (id: string) => 
    api.get<{ data: PerformanceCycle }>(`/api/cycles/${id}`),

  // Get all cycles
  getList: (status?: string) => {
    const url = status ? `/api/cycles?status=${status}` : '/api/cycles';
    return api.get<{ data: PerformanceCycle[] }>(url);
  },

  // Create cycle
  create: (data: Partial<PerformanceCycle>) => 
    api.post<{ data: PerformanceCycle }>('/api/cycles', data),

  // Update cycle
  update: (id: string, data: Partial<PerformanceCycle>) => 
    api.put<{ data: PerformanceCycle }>(`/api/cycles/${id}`, data),

  // Delete cycle
  delete: (id: string) => 
    api.delete(`/api/cycles/${id}`),

  // Get quarterly cycles for a performance cycle
  getQuarterlyCycles: (cycleId: string) =>
    api.get<{ data: QuarterlyCycle[] }>(`/api/cycles/${cycleId}/quarterly-cycles`),

  // Get goals quarterly cycles for a performance cycle
  getGoalsQuarterlyCycles: (cycleId: string) =>
    api.get<{ data: GoalsQuarterlyCycle[] }>(`/api/cycles/${cycleId}/goals-quarterly-cycles`),

  // Get specific quarter's goals cycle
  getGoalsQuarterlyCycle: (cycleId: string, quarter: number) =>
    api.get<{ data: GoalsQuarterlyCycle }>(`/api/cycles/${cycleId}/goals-quarterly-cycles/${quarter}`),

  // Update goals quarterly cycle
  updateGoalsQuarterlyCycle: (cycleId: string, quarter: number, data: Partial<GoalsQuarterlyCycle>) =>
    api.put<{ data: GoalsQuarterlyCycle }>(`/api/cycles/${cycleId}/goals-quarterly-cycles/${quarter}`, data),

  // Update quarterly cycle
  updateQuarterlyCycle: (cycleId: string, quarter: number, data: Partial<QuarterlyCycle>) =>
    api.put<{ data: QuarterlyCycle }>(`/api/cycles/${cycleId}/quarterly-cycles/${quarter}`, data),
};
