// Calibration Service - Calibration groups and entries
import { api } from './api';
import type { CalibrationGroup, CalibrationEntry } from '@/types';

export interface CreateCalibrationGroupData {
  name: string;
  description?: string | null;
  cycle_id: string;
  filters?: {
    department?: string;
    grade?: string;
    business_unit?: string;
  };
  status?: string;
  created_by?: string | null;
}

export interface CreateCalibrationEntryData {
  employee_id: string;
  original_rating: number;
  calibrated_rating?: number;
}

export interface QuotaRuleData {
  rating_value: number;
  percentage: number;
}

export const calibrationService = {
  // ========== Calibration Groups ==========
  groups: {
    getAll: (cycleId?: string, status?: string) => {
      const params = new URLSearchParams();
      if (cycleId) params.append('cycle_id', cycleId);
      if (status) params.append('status', status);
      const queryString = params.toString();
      return api.get<{ data: CalibrationGroup[] }>(
        `/api/calibration/groups${queryString ? `?${queryString}` : ''}`
      );
    },

    getById: (id: string) => 
      api.get<{ data: CalibrationGroup }>(`/api/calibration/groups/${id}`),

    create: (data: CreateCalibrationGroupData) => 
      api.post<{ data: CalibrationGroup }>('/api/calibration/groups', data),

    update: (id: string, data: Partial<CalibrationGroup>) => 
      api.put<{ data: CalibrationGroup }>(`/api/calibration/groups/${id}`, data),

    delete: (id: string) => 
      api.delete(`/api/calibration/groups/${id}`),
  },

  // ========== Quota Rules ==========
  quotaRules: {
    getByGroup: (groupId: string) => 
      api.get<{ data: QuotaRuleData[] }>(`/api/calibration/groups/${groupId}/quota-rules`),

    create: (groupId: string, data: QuotaRuleData) => 
      api.post(`/api/calibration/groups/${groupId}/quota-rules`, data),
  },

  // ========== Calibration Entries ==========
  entries: {
    getByGroup: (groupId: string) => 
      api.get<{ data: CalibrationEntry[] }>(
        `/api/calibration/groups/${groupId}/entries`
      ),

    getByGroupIds: (groupIds: string[]) => 
      api.get<{ data: CalibrationEntry[] }>(
        `/api/calibration/entries?group_ids=${groupIds.join(',')}`
      ),

    create: (groupId: string, data: CreateCalibrationEntryData) => 
      api.post<{ data: CalibrationEntry }>(
        `/api/calibration/groups/${groupId}/entries`,
        data
      ),

    update: (entryId: string, data: Partial<CalibrationEntry>) => 
      api.put<{ data: CalibrationEntry }>(
        `/api/calibration/entries/${entryId}`,
        data
      ),
  },

  // ========== Calibration Settings ==========
  settings: {
    get: () => api.get<{ data: { is_enabled: boolean } }>('/api/settings/calibration'),
    
    update: (data: { is_enabled: boolean }) => 
      api.put('/api/settings/calibration', data),

    getDefaultQuotas: () => 
      api.get<{ data: QuotaRuleData[] }>('/api/settings/calibration/default-quotas'),

    updateDefaultQuotas: (quotas: QuotaRuleData[]) => 
      api.put('/api/settings/calibration/default-quotas', { quotas }),

    getDepartmentQuotas: () => 
      api.get<{ data: { department: string; rating_value: number; percentage: number }[] }>(
        '/api/settings/calibration/department-quotas'
      ),

    updateDepartmentQuotas: (overrides: { department: string; rating_value: number; percentage: number }[]) => 
      api.put('/api/settings/calibration/department-quotas', { overrides }),
  },
};
