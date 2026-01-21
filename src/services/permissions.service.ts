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
}

export interface LateSubmissionDetails {
  totalEmployees: number;
  submitted: number;
  missedDeadline: number;
  lateAccessGranted: number;
  quarter?: number;
  isPastDeadline?: boolean;
}

export const permissionsService = {
  lateSubmission: {
    getByCycle: (cycleId: string, quarter?: number | 'year-end') => {
      let url = `/api/permissions/late-submission?cycle_id=${cycleId}`;
      if (quarter) {
        url += `&quarter=${quarter}`;
      }
      return api.get<{ data: LateSubmissionEmployee[] }>(url);
    },

    check: (cycleId: string, employeeId: string) => 
      api.get<{ data: LateSubmissionPermission[] }>(
        `/api/permissions/late-submission?cycle_id=${cycleId}&employee_id=${employeeId}&revoked_at=null`
      ),

    grant: (data: { cycle_id: string; employee_id: string; granted_by: string; reason?: string; expires_at?: string; quarter?: number | 'year-end' }) => 
      api.post<{ data: LateSubmissionPermission }>(
        '/api/permissions/late-submission',
        data
      ),

    revoke: (cycleId: string, employeeId: string, quarter?: number | 'year-end') => 
      api.put(
        `/api/permissions/late-submission/${cycleId}/${employeeId}/revoke`,
        quarter ? { quarter } : {}
      ),

    getDetails: (cycleId: string, quarter?: number | 'year-end') => {
      let url = `/api/permissions/late-submission-details?cycle_id=${cycleId}`;
      if (quarter) {
        url += `&quarter=${quarter}`;
      }
      return api.get<{ data: LateSubmissionDetails }>(url);
    },
  },
};
