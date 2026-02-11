// Permissions Service - Late submission and other permissions
import { api } from './api';

export interface LateSubmissionPermission {
  id: string;
  cycle_id: string;
  employee_id: string;
  granted_by: string;
  granted_at: string;
  revoked_at?: string | null;
  quarter?: number | null;  // null means all quarters
  reason?: string | null;
  expires_at?: string | null;
}

export interface LateSubmissionEmployee {
  employee_id: string;
  emp_code: string;
  employee_name: string;
  employee_email: string;
  department: string;
  date_of_joining?: string;  // Employee join date
  manager_code?: string | null;
  manager_id?: string | null;
  manager_emp_code?: string | null;
  manager_name?: string | null;
  has_submitted: boolean;
  permission: LateSubmissionPermission | null;
  needs_permission: boolean;
  pending_reportees?: Array<{
    employee_id: string;
    emp_code: string;
    employee_name: string;
    date_of_joining?: string;
  }>;
  pending_employees?: Array<{
    employee_id: string;
    emp_code: string;
    employee_name: string;
    pending_goals_count?: number;
  }>;
}

export interface LateSubmissionDetails {
  totalEmployees?: number;
  totalManagers?: number;
  goals: {
    submitted: number;
    missedDeadline: number;
    lateAccessGranted: number;
    allowLateSubmission?: boolean; // Global toggle from goals_quarterly_cycles
    quarter: number | null;
    isPastDeadline: boolean;
    hasStarted?: boolean;
    startDate?: string | null;
  };
  evaluations: {
    submitted: number;
    missedDeadline: number;
    lateAccessGranted: number;
    quarter: number | null;
    isPastDeadline: boolean;
    hasStarted?: boolean;
    startDate?: string | null;
  };
  managerEvaluations?: {
    submitted: number;
    missedDeadline: number;
    lateAccessGranted: number;
    quarter: number | null;
    isPastDeadline: boolean;
    hasStarted?: boolean;
    startDate?: string | null;
  };
  managerGoalsApproval?: {
    submitted: number;
    missedDeadline: number;
    lateAccessGranted: number;
    quarter: number | null;
    isPastDeadline: boolean;
    hasStarted?: boolean;
    startDate?: string | null;
  };
}

export const permissionsService = {
  lateSubmission: {
    getByCycle: (cycleId: string, quarter?: number | 'year-end', type?: 'goals' | 'evaluations' | 'manager-evaluations' | 'manager-goals-approval', role?: 'employee' | 'manager') => {
      let url = `/api/permissions/late-submission?cycle_id=${cycleId}`;
      if (quarter) {
        url += `&quarter=${quarter}`;
      }
      if (type) {
        url += `&type=${type}`;
      }
      if (role) {
        url += `&role=${role}`;
      }
      return api.get<{ data: LateSubmissionEmployee[] }>(url);
    },

    check: (cycleId: string, quarter?: number) => 
      api.get<{ data: LateSubmissionPermission[]; hasPermission: boolean }>(
        `/api/permissions/late-submission/check?cycle_id=${cycleId}${quarter ? `&quarter=${quarter}` : ''}`
      ),

    grant: (data: { cycle_id: string; employee_id: string; granted_by: string; reason?: string; expires_at?: string; quarter?: number | 'year-end'; type?: 'goals' | 'evaluations' | 'manager-evaluations' | 'manager-goals-approval'; role?: 'employee' | 'manager' }) => 
      api.post<{ data: LateSubmissionPermission }>(
        '/api/permissions/late-submission',
        data
      ),

    revoke: (cycleId: string, employeeId: string, quarter?: number | 'year-end') => 
      api.put(
        `/api/permissions/late-submission/${cycleId}/${employeeId}/revoke`,
        quarter ? { quarter } : {}
      ),

    getDetails: (cycleId: string, quarter?: number | 'year-end', type?: 'goals' | 'evaluations' | 'manager-evaluations' | 'manager-goals-approval') => {
      let url = `/api/permissions/late-submission-details?cycle_id=${cycleId}`;
      if (quarter) {
        url += `&quarter=${quarter}`;
      }
      if (type) {
        url += `&type=${type}`;
      }
      return api.get<{ data: LateSubmissionDetails }>(url);
    },
    getEmployeeQuarterlyStatus: (empCode: string, cycleId: string) => {
      return api.get<{ 
        data: {
          employee: {
            id: string;
            emp_code: string;
            full_name: string;
            email: string;
            department: string;
          };
          quarters: Array<{
            quarter: number;
            goals: {
              employee_status: 'submitted' | 'pending';
              employee_submitted_at: string | null;
              manager_status: 'approved' | 'pending';
              manager_approved_at: string | null;
            };
            evaluations: {
              employee_status: 'submitted' | 'pending';
              employee_submitted_at: string | null;
              manager_status: 'submitted' | 'pending';
              manager_submitted_at: string | null;
            };
          }>;
        }
      }>(`/api/permissions/employee-quarterly-status?emp_code=${empCode}&cycle_id=${cycleId}`);
    },
  },
};
