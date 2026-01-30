// Delegation Service - All delegation-related API calls
import { api } from './api';

export interface Delegation {
  id: string;
  manager_id: string;
  delegate_id: string;
  reportee_id: string;
  cycle_id: string;
  quarter: number;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
  manager_name?: string;
  manager_email?: string;
  manager_code?: string;
  delegate_name?: string;
  delegate_email?: string;
  delegate_code?: string;
  reportee_name?: string;
  reportee_email?: string;
  reportee_code?: string;
}

export interface CreateDelegationData {
  delegate_id: string;
  reportee_id: string;
  cycle_id: string;
  quarter: number;
}

export interface DelegationFilters {
  manager_id?: string;
  delegate_id?: string;
  reportee_id?: string;
  cycle_id?: string;
  quarter?: number;
}

export const delegationService = {
  // Get delegations
  get: (filters?: DelegationFilters) => {
    const params = new URLSearchParams();
    if (filters?.manager_id) params.append('manager_id', filters.manager_id);
    if (filters?.delegate_id) params.append('delegate_id', filters.delegate_id);
    if (filters?.reportee_id) params.append('reportee_id', filters.reportee_id);
    if (filters?.cycle_id) params.append('cycle_id', filters.cycle_id);
    if (filters?.quarter) params.append('quarter', String(filters.quarter));
    
    const queryString = params.toString();
    return api.get<{ data: Delegation[] }>(
      `/api/delegations${queryString ? `?${queryString}` : ''}`
    );
  },

  // Create delegation
  create: (data: CreateDelegationData) =>
    api.post<{ data: Delegation }>('/api/delegations', data),

  // Revoke delegation
  revoke: (id: string) =>
    api.delete<{ data: Delegation }>(`/api/delegations/${id}`),

  // Search employees for delegation
  searchEmployees: (query: string, limit = 10) => {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', String(limit));
    return api.get<{ data: Array<{
      id: string;
      full_name: string;
      email: string;
      emp_code: string;
      department: string;
      grade: string;
    }> }>(`/api/delegations/search?${params.toString()}`);
  },
};
