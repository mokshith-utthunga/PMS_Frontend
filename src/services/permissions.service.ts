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
}

export const permissionsService = {
  lateSubmission: {
    getByCycle: (cycleId: string, quarter?: number | 'year-end', type?: 'goals' | 'evaluations' | 'manager-evaluations') => {
      let url = `/api/permissions/late-submission?cycle_id=${cycleId}`;
      if (quarter) {
        url += `&quarter=${quarter}`;
      }
      if (type) {
        url += `&type=${type}`;
      }
      return api.get<{ data: LateSubmissionEmployee[] }>(url);
    },

    check: (cycleId: string, quarter?: number) => 
      api.get<{ data: LateSubmissionPermission[]; hasPermission: boolean }>(
        `/api/permissions/late-submission/check?cycle_id=${cycleId}${quarter ? `&quarter=${quarter}` : ''}`
      ),

    grant: (data: { cycle_id: string; employee_id: string; granted_by: string; reason?: string; expires_at?: string; quarter?: number | 'year-end'; type?: 'goals' | 'evaluations' | 'manager-evaluations' }) => 
      api.post<{ data: LateSubmissionPermission }>(
        '/api/permissions/late-submission',
        data
      ),

    revoke: (cycleId: string, employeeId: string, quarter?: number | 'year-end') => 
      api.put(
        `/api/permissions/late-submission/${cycleId}/${employeeId}/revoke`,
        quarter ? { quarter } : {}
      ),

    getDetails: (cycleId: string, quarter?: number | 'year-end', type?: 'goals' | 'evaluations' | 'manager-evaluations') => {
      let url = `/api/permissions/late-submission-details?cycle_id=${cycleId}`;
      if (quarter) {
        url += `&quarter=${quarter}`;
      }
      if (type) {
        url += `&type=${type}`;
      }
      return api.get<{ data: LateSubmissionDetails }>(url);
    },
  },
};
