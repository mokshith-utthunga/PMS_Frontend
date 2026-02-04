// Transition Service - Mid-Quarter Employee Transitions API calls
import { api } from './api';

export type TransitionType = 'promotion' | 'project_change' | 'role_change';
export type PeriodType = 'full_quarter' | 'pre_transition' | 'post_transition';

export interface EmployeeQuarterTransition {
  id: string;
  employee_id: string;
  cycle_id: string;
  quarter: number;
  transition_type: TransitionType;
  transition_date: string;
  old_manager_id?: string | null;
  new_manager_id?: string | null;
  old_department?: string | null;
  new_department?: string | null;
  old_project?: string | null;
  new_project?: string | null;
  old_grade?: string | null;
  new_grade?: string | null;
  old_period_closed: boolean;
  old_period_reviewed: boolean;
  new_period_goals_set: boolean;
  new_period_approved: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  name?: string | null;
  emp_code?: string | null;
  old_manager_name?: string | null;
  new_manager_name?: string | null;
  pre_period_start_date?: string | null;
  pre_period_end_date?: string | null;
  post_period_start_date?: string | null;
  post_period_end_date?: string | null;
}

export interface CreateTransitionData {
  cycle_id: string;
  quarter: number;
  transition_type: TransitionType;
  transition_date: string;
  new_manager_id?: string | null;
  new_department?: string | null;
  new_grade?: string | null;
  new_project?: string | null;
}

export interface UpdateTransitionStatusData {
  old_period_reviewed?: boolean;
  new_period_goals_set?: boolean;
  new_period_approved?: boolean;
}

export const transitionService = {
  /**
   * Create a transition for an employee
   */
  create: async (employeeId: string, data: CreateTransitionData): Promise<EmployeeQuarterTransition> => {
    const response = await api.post<{ data: EmployeeQuarterTransition }>(
      `/employees/${employeeId}/transitions`,
      data
    );
    return response.data;
  },

  /**
   * Get all transitions for an employee
   */
  getByEmployee: async (
    employeeId: string,
    cycleId?: string | null,
    quarter?: number | null
  ): Promise<EmployeeQuarterTransition[]> => {
    const params = new URLSearchParams();
    if (cycleId) params.append('cycle_id', cycleId);
    if (quarter) params.append('quarter', quarter.toString());
    
    const query = params.toString();
    const response = await api.get<{ data: EmployeeQuarterTransition[] }>(
      `/employees/${employeeId}/transitions${query ? `?${query}` : ''}`
    );
    return response.data || [];
  },

  /**
   * Get a specific transition by ID
   */
  getById: async (employeeId: string, transitionId: string): Promise<EmployeeQuarterTransition> => {
    const response = await api.get<{ data: EmployeeQuarterTransition }>(
      `/employees/${employeeId}/transitions/${transitionId}`
    );
    return response.data;
  },

  /**
   * Update transition status
   */
  updateStatus: async (
    employeeId: string,
    transitionId: string,
    data: UpdateTransitionStatusData
  ): Promise<EmployeeQuarterTransition> => {
    const response = await api.put<{ data: EmployeeQuarterTransition }>(
      `/employees/${employeeId}/transitions/${transitionId}/status`,
      data
    );
    return response.data;
  },
};
